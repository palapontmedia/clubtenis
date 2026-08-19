export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Rally Club. Todos los derechos reservados.</p>
        <p>Club de Tenis de Oliva</p>
      </div>
    </footer>
  );
}
