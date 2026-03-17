export const metadata = {
  title: "Golf Wager",
  description: "Track your golf betting games on the course",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Golf Wager" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B1A14",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#0B1A14", overscrollBehavior: "none" }}>
        {children}
      </body>
    </html>
  );
}
