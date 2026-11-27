import numpy as np
from scipy.signal import periodogram, resample_poly


def estimate_breath_rate(signal):
    """Estimate breaths/min from a periodic mattress displacement in a 30 s window."""
    if len(signal) < 15000 or not np.all(np.isfinite(signal)):
        return None
    samples = np.asarray(signal, dtype=float)
    low, high = np.percentile(samples, [1, 99])
    if high <= low:
        return None
    wave = resample_poly(np.clip(samples, low, high) - np.median(samples), 1, 50)
    hz, power = periodogram(wave, fs=10, window='hann', detrend='linear')
    band = (hz >= 0.1) & (hz <= 0.5)
    idx = np.flatnonzero(band)[np.argmax(power[band])]
    total = power[(hz > 0) & (hz <= 0.65)].sum()
    if total <= 0 or power[idx] / total < 0.35:
        return None
    return float(60 * hz[idx])
