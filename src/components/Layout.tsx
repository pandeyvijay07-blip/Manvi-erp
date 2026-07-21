import { ReactNode } from "react";

type LayoutProps = {
  title: string;
  children: ReactNode;
};

export default function Layout({ title, children }: LayoutProps) {
  return (
    <div
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "16px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          marginBottom: "20px",
          borderBottom: "1px solid #ddd",
          paddingBottom: "10px",
        }}
      >
        <h1 style={{ margin: 0 }}>MANVI ERP</h1>
        <h3 style={{ marginTop: "8px" }}>{title}</h3>
      </header>

      <main>{children}</main>
    </div>
  );
}
