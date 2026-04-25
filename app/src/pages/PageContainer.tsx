import React from 'react';
import { Container, ContainerProps } from '@mui/material';
import { SxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ErrorBoundary from '@components/ErrorBoundary.tsx';


type PageContainerProps = {
  containerProps?: ContainerProps;
  sx?: SxProps
}

export default function PageContainer({ children, sx, containerProps }: React.PropsWithChildren<PageContainerProps>) {
  const theme = useTheme();

  return (
    <ErrorBoundary componentName='Page container'>
      <Container
        { ...containerProps }
        id='PageContainer'
        sx={ {
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          alignItems: 'center',
          gap: 2,
          margin: 0,
          justifyContent: 'center',
          [theme.breakpoints.up('sm')]: {
            width: '90%',
            padding: 0,
            paddingTop: 5,
            paddingBottom: 6,
            maxWidth: '600px',
          },
          [theme.breakpoints.down('sm')]: {
            width: '100%',
            paddingLeft: 2,
            paddingRight: 2,
            paddingTop: 1,
            paddingBottom: '100px',
          },
          ...sx,
        } }
      >
        { children }
      </Container>
    </ErrorBoundary>
  );
}
