import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import { SearchIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function Command({
  className,
  ...props
}) {
  return (
    (<CommandPrimitive
      data-slot="command"
      className={cn(
        "bg-white text-slate-950 flex size-full flex-col overflow-hidden rounded-md dark:bg-slate-950 dark:text-slate-50",
        className
      )}
      {...props} />)
  );
}

function CommandDialog({
  title = "Command Palette",
  description = "Search for a command to run...",
  children,
  ...props
}) {
  return (
    (<Dialog {...props}>
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg [&>button:last-child]:hidden">
        <Command
          className="[&_[cmdk-group-heading]]:text-slate-500 max-h-[100svh] **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2 dark:[&_[cmdk-group-heading]]:text-slate-400">
          {children}
        </Command>
      </DialogContent>
    </Dialog>)
  );
}

function CommandInput({
  className,
  ...props
}) {
  return (
    (<div
      className="border-slate-200 flex items-center border-b px-5 dark:border-slate-800"
      cmdk-input-wrapper="">
      <SearchIcon size={20} className="text-slate-500/80 me-3 dark:text-slate-400/80" />
      <CommandPrimitive.Input
        data-slot="command-input-wrapper"
        className={cn(
          "placeholder:text-slate-500/70 flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 dark:placeholder:text-slate-400/70",
          className
        )}
        {...props} />
    </div>)
  );
}

function CommandList({
  className,
  ...props
}) {
  return (
    (<CommandPrimitive.List
      data-slot="command-list"
      className={cn("max-h-80 flex-1 overflow-x-hidden overflow-y-auto", className)}
      {...props} />)
  );
}

function CommandEmpty({
  ...props
}) {
  return (<CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...props} />);
}

function CommandGroup({
  className,
  ...props
}) {
  return (
    (<CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "text-slate-950 [&_[cmdk-group-heading]]:text-slate-500 overflow-hidden p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium dark:text-slate-50 dark:[&_[cmdk-group-heading]]:text-slate-400",
        className
      )}
      {...props} />)
  );
}

function CommandSeparator({
  className,
  ...props
}) {
  return (
    (<CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("bg-slate-200 -mx-1 h-px dark:bg-slate-800", className)}
      {...props} />)
  );
}

function CommandItem({
  className,
  ...props
}) {
  return (
    (<CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900 relative flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 dark:data-[selected=true]:bg-slate-800 dark:data-[selected=true]:text-slate-50",
        className
      )}
      {...props} />)
  );
}

function CommandShortcut({
  className,
  ...props
}) {
  return (
    (<kbd
      data-slot="command-shortcut"
      className={cn(
        "bg-white text-slate-500/70 ms-auto -me-1 inline-flex h-5 max-h-full items-center rounded border border-slate-200 px-1 font-[inherit] text-[0.625rem] font-medium dark:bg-slate-950 dark:text-slate-400/70 dark:border-slate-800",
        className
      )}
      {...props} />)
  );
}

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
