"""
This module defines the `BiometricProcessor` class, which processes biometric signals
from piezoelectric sensors to extract heart rate, heart rate variability (HRV), and
breathing rate. It applies signal cleaning, filtering, and outlier detection to ensure
accurate physiological measurements.

Key functionalities:
- Detects user presence based on piezo signal range.
- Applies preprocessing steps such as outlier interpolation, scaling, and filtering.
- Extracts heart rate, HRV, and breathing rate using a sliding window approach.
- Validates heart rate values against defined thresholds to reduce false positives.
- Periodically inserts smoothed biometric data into an SQL database.
- Supports multiple sensors and handles missing or noisy signals.
- Implements garbage collection for memory efficiency.

Usage:
Instantiate `BiometricProcessor` and call `calculate_vitals(epoch, signal1, signal2)`
with sensor data to process and extract biometric metrics.
"""
import datetime
import gc
from typing import Union, Tuple, TypedDict, List, Optional, Deque
import traceback
import numpy as np
import json
from collections import deque
import urllib.request
import urllib.error

from get_logger import get_logger
from heart.exceptions import BadSignalWarning
from vitals.run_data_types import RuntimeParams
from vitals.cleaning import interpolate_outliers_in_wave
from heart.preprocessing import scale_data
from heart.filtering import filter_signal, remove_baseline_wander
from heart.heartpy import process
from db import insert_vitals
from data_types import *

logger = get_logger()


class BiometricProcessor:
    heart_rates: Deque[float]   # Store last moving_avg_size heart rates (120)
    breath_rates: Deque[float]  # Store last breath rates
    hrv_rates: Deque[float]     # Store last HRV rates
    lower_bound: Optional[np.floating]  # Lower bound of HR (None if not set)
    upper_bound: Optional[np.floating]  # Upper bound of HR (None if not set)
    hr_moving_avg: Optional[np.floating]  # Current moving average heart rate
    hr_std_2: Optional[float]  # Standard deviation of heart rate
    epoch: int
    def __init__(
            self,
            side: str = 'left',
            sensor_count=1,
            runtime_params: RuntimeParams = None,
            insertion_frequency=60,
            rolling_average_size=25,
            debug=False,
            api_host='127.0.0.1',  # Added API configuration
            api_port=3000,  # Added API configuration
    ):
        self.present = False
        self.side = side
        self.sensor_count = sensor_count
        self.insertion_frequency = insertion_frequency
        self.iteration_count = 0
        self.rolling_average_size = rolling_average_size
        self.debug = debug

        # API configuration for presence updates
        self.api_host = api_host
        self.api_port = api_port
        self.presence_api_url = f'http://{api_host}:{api_port}/api/metrics/presence'

        self.heart_rate_window_seconds = 3
        self.breath_rate_window_seconds = 30
        self.breath_rate_insertion_frequency = 10

        self.hrv_window_seconds = 300
        self.hrv_insertion_frequency = 30


        if runtime_params is None:
            runtime_params: RuntimeParams = {
                'window': 3,
                'slide_by': 1,
                'moving_avg_size': 120,
                'hr_std_range': (1, 10),
                'hr_percentile': (15, 80),
                'signal_percentile': (0.2, 99.8),
                'window_size': 0.65,
            }

        self.slide_by = runtime_params['slide_by']  # Sliding window step size in seconds
        self.window = runtime_params['window']  # Window size in seconds
        self.hr_std_range = runtime_params['hr_std_range']  # Heart rate standard deviation range (lower, upper)
        self.hr_percentile = runtime_params['hr_percentile']  # Accepted percentile range for heart rate (lower, upper)
        self.moving_avg_size = runtime_params['moving_avg_size']  # Moving average window size in seconds
        self.signal_percentile = runtime_params['signal_percentile']  # Percent of outliers from raw signal to replace
        self.window_size = runtime_params['window_size']
        self.runtime_params = runtime_params
        self.init_tracking()
        self.no_presence_tolerance = 10
        self.breathing_rate = 0
        self.hrv = 0
        self.not_present_for = 0
        self.present_for = 0
        self.combined_measurements: Deque[Measurement] = deque([], maxlen=100)
        self.debug_measurements: List[Measurement] = []

    def init_tracking(self):
        # Running metrics
        self.heart_rates:  Deque[float] = deque([], maxlen=self.moving_avg_size)
        self.breath_rates:  Deque[float] = deque([], maxlen=6)
        self.hrv_rates:  Deque[float] = deque([], maxlen=10)
        self.lower_bound = None
        self.upper_bound = None
        self.hr_moving_avg = None
        self.hr_std_2 = None

    def reset(self):
        self.iteration_count = 0
        self.init_tracking()

    def _update_presence_api(self, is_present: bool):
        """
        Send presence update to the API endpoint.

        Args:
            is_present: Boolean indicating if presence is detected
        """
        try:
            # Build the payload based on which side this processor handles
            payload = {
                self.side: {
                    "present": is_present,
                }
            }

            # Convert payload to JSON bytes
            data = json.dumps(payload).encode('utf-8')

            # Create the request
            req = urllib.request.Request(
                self.presence_api_url,
                data=data,
                headers={'Content-Type': 'application/json'},
                method='POST'
            )

            # Make the request with timeout
            with urllib.request.urlopen(req, timeout=2) as response:
                if response.status == 200:
                    logger.debug(f'Successfully updated presence API for {self.side} side: {is_present}')
                else:
                    response_body = response.read().decode('utf-8')
                    logger.warning(f'Presence API returned status {response.status}: {response_body}')

        except urllib.error.URLError as e:
            if isinstance(e.reason, TimeoutError):
                logger.warning(f'Presence API request timed out for {self.side} side')
            else:
                logger.warning(f'Could not connect to presence API at {self.presence_api_url}: {e.reason}')
        except Exception as e:
            logger.error(f'Error updating presence API: {e}')

    def detect_presence(self, signal: np.ndarray):
        signal_range = np.ptp(signal)
        if signal_range > 200_000:
            self.not_present_for = 0
            self.present_for = self.present_for + 1

            # Update presence to True if not already set
            if not self.present:
                self.present = True
                self._update_presence_api(True)
            else:
                self.present = True
        else:
            self.not_present_for += 1
            if self.not_present_for == self.no_presence_tolerance:
                logger.info(f'User not detected for {self.no_presence_tolerance} seconds on {self.side} side, resetting...')
                self.present = False
                self.present_for = 0
                self.reset()

                # Update API that presence is no longer detected
                self._update_presence_api(False)

    def _calculate_vitals(self, signal: np.ndarray, epoch: int, update_breathing=False, update_hrv=False):
        try:
            # Remove outliers from signal
            data = interpolate_outliers_in_wave(
                signal,
                lower_percentile=self.signal_percentile[0],
                upper_percentile=self.signal_percentile[1],
            )

            data = scale_data(data, lower=0, upper=1024)
            data = remove_baseline_wander(data, sample_rate=500.0, cutoff=0.05)

            data = filter_signal(
                data,
                cutoff=[0.5, 20.0],
                sample_rate=500.0,
                order=2,
                filtertype='bandpass'
            )

            working_data, measurement = process(
                data,
                500,
                breathing_method='fft',
                bpmmin=40,
                bpmmax=90,
                windowsize=self.window_size,
                calculate_breathing=update_breathing,
            )
            if update_breathing:
                breathing_rate = measurement.get('breathingrate', 0) * 60
                if (8 <= breathing_rate <= 20) and not np.isnan(breathing_rate):
                    self.breath_rates.append(breathing_rate)
                    breathing_rate = sum(self.breath_rates) / len(self.breath_rates)
                    if not np.isnan(breathing_rate):
                        self.breathing_rate = breathing_rate

            if update_hrv:
                hrv = measurement['sdnn']
                if (8 <= hrv <= 200) and not np.isnan(hrv):
                    self.hrv_rates.append(hrv)
                    hrv = sum(self.hrv_rates) / len(self.hrv_rates)

                    if not np.isnan(hrv):
                        self.hrv = hrv


            if self.is_valid(measurement):
                return {
                    'side': self.side,
                    'timestamp': epoch,
                    'heart_rate': measurement['bpm'],
                    'hrv': self.hrv,
                    'breathing_rate': self.breathing_rate,
                }
        except BadSignalWarning:
            return None
        except Exception as e:
            error_message = traceback.format_exc()
            logger.error(e)
            logger.error(error_message)
            return None

    def calculate_heart_rate(self, epoch: int, signal1: np.ndarray, signal2: Union[None, np.ndarray] = None):
        self.epoch = epoch
        measurement_2 = None
        measurement_1 = self._calculate_vitals(signal1, epoch)

        if signal2 is not None:
            measurement_2 = self._calculate_vitals(signal2, epoch)

        if measurement_1 is not None and measurement_2 is not None:
            m1_heart_rate = measurement_1['heart_rate']
            m2_heart_rate = measurement_2['heart_rate']
            if self.hr_moving_avg is not None:
                heart_rate = (((m1_heart_rate + m2_heart_rate) / 2) + self.hr_moving_avg) / 2
            else:
                heart_rate = (m1_heart_rate + m2_heart_rate) / 2

            if self.hr_moving_avg is not None and abs(heart_rate - self.hr_moving_avg) > self.hr_std_2:
                if heart_rate < self.hr_moving_avg:
                    heart_rate = self.hr_moving_avg - self.hr_std_2
                else:
                    heart_rate = self.hr_moving_avg + self.hr_std_2

            self.heart_rates.append(heart_rate)

            self.combined_measurements.append({
                'side': self.side,
                'timestamp': epoch,
                'heart_rate': heart_rate,
                'hrv': self.hrv,
                'breathing_rate': self.breathing_rate,
            })

        elif measurement_1 is not None:
            m1_heart_rate = measurement_1['heart_rate']

            # If the HR differs by more than the allowable movement
            if self.hr_moving_avg is not None and abs(m1_heart_rate - self.hr_moving_avg) > self.hr_std_2:
                if m1_heart_rate < self.hr_moving_avg:
                    m1_heart_rate = self.hr_moving_avg - self.hr_std_2
                else:
                    m1_heart_rate = self.hr_moving_avg + self.hr_std_2

            self.heart_rates.append(m1_heart_rate)

            measurement_1['heart_rate'] = m1_heart_rate
            self.combined_measurements.append(measurement_1)

        elif measurement_2 is not None:
            m2_heart_rate = measurement_2['heart_rate']

            if self.hr_moving_avg is not None:
                heart_rate = (m2_heart_rate + self.hr_moving_avg) / 2
            else:
                heart_rate = m2_heart_rate

            if self.hr_moving_avg is not None and abs(heart_rate - self.hr_moving_avg) > self.hr_std_2:
                if heart_rate < self.hr_moving_avg:
                    heart_rate = self.hr_moving_avg - self.hr_std_2
                else:
                    heart_rate = self.hr_moving_avg + self.hr_std_2

            self.heart_rates.append(heart_rate)

            measurement_2['heart_rate'] = heart_rate
            self.combined_measurements.append(measurement_2)
        self.next()

    def is_valid(self, measurement) -> bool:
        if np.isnan(measurement['bpm']):
            return False

        if measurement['bpm'] > 90:
            return False
        if self.lower_bound is not None and self.upper_bound is not None:
            if self.lower_bound < measurement['bpm'] < self.upper_bound:
                return True
            else:
                return False
        return True

    def next(self):
        self.iteration_count += 1

        # Insert moving average heart rate to DB
        if self.iteration_count % self.insertion_frequency == 0 and len(self.combined_measurements) > 0:
            heart_rate = np.mean(list(self.heart_rates)[self.rolling_average_size * -1:])
            # Convert last heart rate to average
            self.combined_measurements[-1]['heart_rate'] = heart_rate
            if not self.debug:
                insert_vitals(self.combined_measurements[-1])
            else:
                last_combined_measurement = list(self.combined_measurements)[-1]
                ts = datetime.utcfromtimestamp(last_combined_measurement['timestamp']).isoformat()
                debug_measurement = {
                    **self.combined_measurements[-1],
                    'last_combined_measurement': ts,
                    'current_ts': datetime.utcfromtimestamp(self.epoch).isoformat(),
                    'heart_rate': heart_rate,
                    'last_heart_rates': list(self.heart_rates)[-25:],
                    'hr_moving_avg': self.hr_moving_avg,
                    'lower_bound': self.lower_bound,
                    'upper_bound': self.upper_bound,
                    'hr_std_2': self.hr_std_2,
                    'length': len(self.heart_rates),
                }
                self.debug_measurements.append(debug_measurement)

        # Calculate boundaries for calculations
        if len(self.heart_rates) >= self.moving_avg_size:
            self.hr_moving_avg = np.mean(self.heart_rates)

            self.lower_bound = np.percentile(self.heart_rates, self.hr_percentile[0])
            self.upper_bound = np.percentile(self.heart_rates, self.hr_percentile[1])

            if self.upper_bound - self.lower_bound < 25:
                self.upper_bound = self.hr_moving_avg + 12.5
                self.lower_bound = self.hr_moving_avg - 12.5

            self.hr_std_2 = np.std(self.heart_rates) * 2
            if self.hr_std_2 < self.hr_std_range[0]:
                self.hr_std_2 = self.hr_std_range[0]
            elif self.hr_std_2 > self.hr_std_range[1]:
                self.hr_std_2 = self.hr_std_range[1]

    def calculate_breath_rate(self, signal1: np.ndarray, epoch: int):
        self._calculate_vitals(signal1, epoch, update_breathing=True)


    def calculate_hrv(self, signal1: np.ndarray, epoch: int):
        self._calculate_vitals(signal1, epoch, update_hrv=True)
