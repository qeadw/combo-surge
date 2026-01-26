import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Combo Surge',
  description: 'A neon rhythm game - build combos, unlock levels, get upgrades!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', backgroundColor: '#0a0a12' }}>
        {children}
      </body>
    </html>
  );
}
