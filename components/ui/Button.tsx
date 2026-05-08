import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  // Base — shared across all variants
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md cursor-pointer",
    "text-sm font-medium tracking-wide",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        // Solid navy — primary action (primary: #18284e, foreground: #fafaf9)
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/85 active:bg-primary/95",

        // Muted outline — secondary actions (border: #e5e5e5, muted bg on hover)
        secondary:
          "border border-border bg-background text-ink hover:bg-muted hover:border-subtle active:bg-muted/70",

        // Teal-filled accent — use sparingly for CTAs (accent: #0d9488)
        accent:
          "bg-accent text-accent-foreground hover:bg-accent/85 active:bg-accent/95",

        // Transparent — toolbar / inline actions
        ghost:
          "text-slate hover:bg-muted hover:text-ink active:bg-muted/70",

        // Bordered outline with accent hover
        outline:
          "border border-border bg-transparent text-ink hover:bg-muted hover:border-primary/30 active:bg-muted/70",

        // Destructive — delete / irreversible actions (destructive: #dc2626)
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/85 active:bg-destructive/95",

        // Text-only link style
        link:
          "text-primary underline-offset-4 hover:underline hover:text-primary/80 p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm:      "h-8  px-3 py-1.5 text-sm",
        lg:      "h-11 px-8 py-2.5 text-base",
        icon:    "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?:   boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, leftIcon, rightIcon, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {leftIcon && (
          <span className="shrink-0 [&_svg]:size-[1em]">{leftIcon}</span>
        )}
        {children}
        {rightIcon && (
          <span className="shrink-0 [&_svg]:size-[1em]">{rightIcon}</span>
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };