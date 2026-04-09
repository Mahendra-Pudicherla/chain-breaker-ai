interface AppShellProps {
  children: React.ReactNode;
}

const AppShell = ({ children }: AppShellProps) => {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar placeholder */}
      <div className="hidden md:block" />
      <div className="flex flex-1 flex-col">
        {/* Topbar placeholder */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
