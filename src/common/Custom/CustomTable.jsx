import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { checkStrEmpty } from "@/utilities"

function CustomTable(props) {
  const { fields = [], data = [], headerStyle, className = "", ...tableProps } = props

  return (
      <Table {...tableProps} className={`!px-0 relative ${className}`}>
        <TableHeader className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800">
          <TableRow className="px-0">
            {fields.map((item, idx) => (
              <TableHead key={idx} className="text-center font-bold text-center rounded text-black" style={headerStyle || {}}>
                {item.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Check if data is empty */}
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={fields.length} className="text-center py-8 text-muted-foreground">
                No data
              </TableCell>
            </TableRow>
          ) : (
            // Render rows if data is not empty
            data.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-muted/50">
                {fields.map((field, fieldIdx) => {
                  // Get the value from the item
                  const val = item[field.value] || ""
                  const value_alt = (field.value_alt && item[field.value_alt]) || ""
                  const cellClassName = field.className ? field.className : ""

                  // If custom component is provided, render it
                  if (field.custom) {
                    return (
                      <TableCell key={fieldIdx} className={cellClassName}>
                        {field.component(item, idx)}
                      </TableCell>
                    )
                  }

                  // Otherwise, render the value or the alternative value
                  return (
                    <TableCell key={fieldIdx} className={cellClassName}>
                      {checkStrEmpty(val) ? value_alt : val || "-"}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
  )
}

export default CustomTable
