import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智考公考伴侣 · AI 申论智能批改",
  description: "专业的申论智能批改和公考题库练习平台，AI个性化学习助手",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
