import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserAvatarContentProps {
  className?: string;
  imageUrl?: string;
  imageAlt?: string;
  fallbackText?: string;
}

export default function UserAvatarContent({
  className,
  imageUrl,
  imageAlt,
  fallbackText,
}: UserAvatarContentProps) {
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
        <AvatarFallback className={className}>
          {fallbackText?.charAt(0).toUpperCase() || "U"}
        </AvatarFallback>
      </Avatar>
    </>
  );
}
