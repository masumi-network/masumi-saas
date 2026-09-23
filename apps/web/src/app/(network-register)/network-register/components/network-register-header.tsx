import Image from "next/image";

type NetworkRegisterHeaderProps = {
  title: string;
  description?: string;
};

export function NetworkRegisterHeader({
  title,
  description,
}: NetworkRegisterHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-background shadow-sm ring-1 ring-black/5">
        <Image
          src="/assets/logo.png"
          alt="Masumi"
          width={64}
          height={64}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
