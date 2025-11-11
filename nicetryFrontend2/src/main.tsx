import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider, theme as antdTheme, App as AntdApp } from 'antd'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.tsx'
import { FarmProvider } from './context/FarmContext'
import { ThemeProvider, useTheme } from './context/ThemeContext' // ✅ THÊM
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'; // ✅ THÊM DÒNG NÀY
// Tạo một QueryClient với các tùy chọn mặc định

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// ✅ Component wrapper để sử dụng useTheme
function AppWithTheme() {
  const { isDark } = useTheme();

  const lightTheme = {
    colorPrimary: '#667eea',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    colorTextBase: '#1f2937',
    colorBgLayout: '#f7f8fc', // Màu nền layout
    borderRadius: 8,
    fontFamily: "'Inter', sans-serif",
  };

  const darkTheme = {
    colorPrimary: '#667eea',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    colorError: '#ef4444',
    colorInfo: '#3b82f6',
    colorTextBase: '#e5e7eb',
    colorBgLayout: '#141414', // Màu nền layout tối
    colorBgContainer: '#1d1d1d', // Màu nền card, modal
    colorBorder: '#303030',
    borderRadius: 8,
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: isDark ? darkTheme : lightTheme,
          components: { // Ghi đè style cho từng component
            Card: {
              headerBg: 'transparent',
              paddingLG: 20, // Tăng padding cho card
            },
            Button: {
              // Làm cho button primary nổi bật hơn
              primaryShadow: '0 2px 0 rgba(102, 126, 234, 0.1)',
            },
          },
        }}
      >
        <AntdApp>
          <QueryClientProvider client={queryClient}>
            <FarmProvider>
              <App />
            </FarmProvider>
          </QueryClientProvider>
        </AntdApp>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppWithTheme />
    </ThemeProvider>
  </React.StrictMode>,
)
