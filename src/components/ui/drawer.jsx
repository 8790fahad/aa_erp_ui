import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { guardDismissWhileLocked, useSessionLocked } from "@/lib/sessionLock"

const Drawer = ({
  shouldScaleBackground = true,
  modal = true,
  ...props
}) => {
  const locked = useSessionLocked();
  return (
    <DrawerPrimitive.Root
      shouldScaleBackground={shouldScaleBackground}
      modal={locked ? false : modal}
      {...props}
    />
  );
}
Drawer.displayName = "Drawer"

const DrawerTrigger = DrawerPrimitive.Trigger

const DrawerPortal = DrawerPrimitive.Portal

const DrawerClose = DrawerPrimitive.Close

const DrawerOverlay = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/80", className)}
    {...props} />
))
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName

const DrawerContent = React.forwardRef(({
  className,
  children,
  side = "bottom",
  onPointerDownOutside,
  onInteractOutside,
  onFocusOutside,
  onEscapeKeyDown,
  ...props
}, ref) => {
  const sideClasses = {
    bottom: "inset-x-0 bottom-0 rounded-t-[10px]",
    top: "inset-x-0 top-0 rounded-b-[10px]",
    left: "inset-y-0 left-0 rounded-r-[10px] w-3/4 sm:max-w-sm",
    right: "inset-y-0 right-0 rounded-l-[10px] w-3/4 sm:max-w-sm",
  };

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        direction={side}
        className={cn(
          "fixed z-50 flex flex-col border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
          sideClasses[side],
          side === "bottom" && "mt-24 h-auto",
          side === "top" && "mb-24 h-auto",
          (side === "left" || side === "right") && "h-full",
          className
        )}
        {...props}
        onPointerDownOutside={guardDismissWhileLocked(onPointerDownOutside)}
        onInteractOutside={guardDismissWhileLocked(onInteractOutside)}
        onFocusOutside={guardDismissWhileLocked(onFocusOutside)}
        onEscapeKeyDown={guardDismissWhileLocked(onEscapeKeyDown)}>
        {side === "bottom" && (
          <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-slate-100 dark:bg-slate-800" />
        )}
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
})
DrawerContent.displayName = "DrawerContent"

const DrawerHeader = ({
  className,
  ...props
}) => (
  <div
    className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
    {...props} />
)
DrawerHeader.displayName = "DrawerHeader"

const DrawerFooter = ({
  className,
  ...props
}) => (
  <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
)
DrawerFooter.displayName = "DrawerFooter"

const DrawerTitle = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props} />
))
DrawerTitle.displayName = DrawerPrimitive.Title.displayName

const DrawerDescription = React.forwardRef(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
    {...props} />
))
DrawerDescription.displayName = DrawerPrimitive.Description.displayName

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
