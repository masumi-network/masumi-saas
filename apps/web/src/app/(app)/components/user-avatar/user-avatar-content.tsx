import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils/format-name";

interface UserAvatarContentProps {
  className?: string;
  imageUrl?: string;
  imageAlt?: string;
  fallbackName?: string;
}

export default function UserAvatarContent({
  className,
  imageUrl,
  imageAlt,
  fallbackName,
}: UserAvatarContentProps) {
  const initials = getInitials(fallbackName);

  return (
    <>
      <Avatar className="h-8 w-8 md:h-10 md:w-10">
        {imageUrl && (
          <AvatarImage
            src={imageUrl}
            alt={imageAlt ?? "User avatar"}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}
        <AvatarFallback className={className}>{initials}</AvatarFallback>
      </Avatar>
    </>
  );
}
