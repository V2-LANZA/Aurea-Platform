"use client";

type AvatarBadgeProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizes = {
  sm: "h-10 w-10 text-sm",
  md: "h-12 w-12 text-base",
  lg: "h-16 w-16 text-lg",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "A";
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function AvatarBadge({
  name,
  avatarUrl,
  size = "md",
}: AvatarBadgeProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-full border border-[#F5D547]/25 bg-[#1b1521] ${sizes[size]}`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-[#F5D547]">
          {initials(name)}
        </div>
      )}
    </div>
  );
}
