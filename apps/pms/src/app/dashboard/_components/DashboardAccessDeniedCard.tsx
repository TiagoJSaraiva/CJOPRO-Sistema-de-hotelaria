type DashboardAccessDeniedCardProps = {
  title: string;
  message: string;
};

export function DashboardAccessDeniedCard({ title, message }: DashboardAccessDeniedCardProps) {
  return (
    <section className="pms-surface-card">
      <h2 className="mt-0">{title}</h2>
      <p>{message}</p>
    </section>
  );
}
