type Props = {
  className?: string;
};

export default function SkeletonCard({ className = "" }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-muted/40 ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
    </div>
  );
}