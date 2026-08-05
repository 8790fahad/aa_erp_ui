import { Label } from "@/components/ui/label";
import {
  CheckIcon,
  ChevronDownIcon,
} from "lucide-react";
import { useId } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";


export default function AccountTypeAhead() {
    const id = useId()
  return (
     <div className="*:not-first:mt-2">
                <Label htmlFor={id}>Select with search</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id={id}
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="bg-background hover:bg-background border-input w-full justify-between px-3 font-normal outline-offset-0 outline-none focus-visible:outline-[3px]"
                    >
                      <span
                        className={cn(
                          "truncate",
                          !formData.head && "text-muted-foreground"
                        )}
                      >
                        {formData.head
                          ? `${
                              existingCodes.filter(
                                (item) => item.head === formData.head
                              )[0]?.description
                            } - ${
                              existingCodes.filter(
                                (item) => item.head === formData.head
                              )[0]?.head
                            } `
                          : "Select account code"}
                      </span>
                      <ChevronDownIcon
                        size={16}
                        className="text-muted-foreground/80 shrink-0"
                        aria-hidden="true"
                      />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="border-input w-full min-w-[var(--radix-popper-anchor-width)] p-0"
                    align="start"
                  >
                    <Command>
                      <CommandInput placeholder="Search account code..." />
                      <CommandList>
                        <CommandEmpty>No account code found.</CommandEmpty>
                        <CommandGroup>
                          {existingCodes.map((framework) => (
                            <CommandItem
                              key={framework.value}
                              value={framework.head}
                              onSelect={(currentValue) => {
                                setFormData({
                                  ...formData,
                                  head: currentValue,
                                });
                                setOpen(false);
                              }}
                            >
                              {`${framework.head} - ${framework.description}`}
                              {formData.head === framework.head && (
                                <CheckIcon size={16} className="ml-auto" />
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
  )
}
