import { ReactNode } from "react";

type Props = {
  title: string;
  children: ReactNode;
};

function Layout({ title, children }: Props) {
  return (
    <div
      style={{
        maxWidth: 500,
        margin: "0 auto",
        padding: 16,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          paddingBottom: 12,
          borderBottom: "1px solid #ddd",
          marginBottom: 20,
        }}
      >
        <h1>MANVI ERP</h1>
        <h2>{title}</h2>
      </header>

      {children}
    </div>
  );
}

export default Layout;
