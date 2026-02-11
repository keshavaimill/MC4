const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          <img
            src="/MC4_Logo.webp"
            alt="MC4 logo"
            className="h-16 w-16 rounded-md object-contain"
          />
        </div>
        <h1 className="mb-4 text-4xl font-bold">Welcome to MC4 Planning</h1>
        <p className="text-xl text-muted-foreground">
          Use the role-based login to explore the enterprise planning platform.
        </p>
      </div>
    </div>
  );
};

export default Index;

