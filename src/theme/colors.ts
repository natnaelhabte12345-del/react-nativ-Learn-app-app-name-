export const brandColors = [
  {
    name: "LINGUA PURPLE",
    hex: "#6C4EF5",
    token: "bg-lingua-purple",
  },
  {
    name: "LINGUA DEEP PURPLE",
    hex: "#5B3BF6",
    token: "bg-lingua-deep-purple",
  },
  {
    name: "LINGUA BLUE",
    hex: "#4D8BFF",
    token: "bg-lingua-blue",
  },
  {
    name: "LINGUA GREEN",
    hex: "#21C16B",
    token: "bg-lingua-green",
  },
] as const;

export const semanticColors = [
  {
    name: "SUCCESS",
    hex: "#21C16B",
    token: "bg-success",
  },
  {
    name: "WARNING",
    hex: "#FFC800",
    token: "bg-warning",
  },
  {
    name: "STREAK",
    hex: "#FF8A00",
    token: "bg-streak",
  },
  {
    name: "ERROR",
    hex: "#FF4D4F",
    token: "bg-error",
  },
  {
    name: "INFO",
    hex: "#4D8BFF",
    token: "bg-info",
  },
] as const;

export const neutralColors = [
  {
    name: "TEXT / PRIMARY",
    hex: "#0D132B",
    token: "bg-text-primary",
    textClassName: "text-white",
  },
  {
    name: "TEXT / SECONDARY",
    hex: "#6B7280",
    token: "bg-text-secondary",
    textClassName: "text-white",
  },
  {
    name: "BORDER",
    hex: "#E5E7EB",
    token: "bg-border",
    textClassName: "text-text-primary",
  },
  {
    name: "SURFACE",
    hex: "#F6F7FB",
    token: "bg-surface",
    textClassName: "text-text-primary",
  },
  {
    name: "BACKGROUND",
    hex: "#FFFFFF",
    token: "bg-background",
    textClassName: "text-text-primary",
    bordered: true,
  },
] as const;
