import { Link, useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-2 text-xl text-muted-foreground">Página não encontrada</p>
        <p className="mb-6 text-sm text-muted-foreground/80 font-mono break-all">{location.pathname}</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Voltar para o início
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
