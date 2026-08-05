"""Rewrite Finished Goods card inner layout in Markup.jsx (space-y-4 rows)."""
from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src" / "components" / "pages" / "sales" / "Markup.jsx"
lines = path.read_text().splitlines(keepends=True)


def find_substr(s: str, start: int = 0) -> int:
    for i in range(start, len(lines)):
        if s in lines[i]:
            return i
    return -1


start_i = find_substr(
    'grid grid-cols-1 gap-4 xl:grid-cols-12 xl:gap-x-4 xl:gap-y-4 items-start'
)
delete_i = find_substr(
    'flex items-end h-full xl:col-span-1 xl:row-start-3 xl:col-start-12'
)
if start_i < 0 or delete_i < 0:
    raise SystemExit(f"start={start_i} delete={delete_i}")

j = delete_i
while j < len(lines) and "                                          </div>" not in lines[j]:
    j += 1
end_i = j + 1

typeahead = lines[7023:7235]
process_block = lines[7314:7422]
if "Multiplier (process costing)" not in process_block[0]:
    raise SystemExit("process block")
process_block[1] = '                                            <div className="space-y-2">\n'

good_input = lines[7258:7286]
expiry_inner = lines[7293:7312]
waste_qty_input = lines[7430:7448]
waste_type_section = lines[7448:7495]
waste_reason_section = lines[7496:7514]
cost_iife_lines = lines[7515:7820]
markup_block = lines[7821:7927]
joint_block = lines[7928:8347]

wts = "".join(waste_type_section)
wts = wts.replace(
    'block text-sm font-semibold text-gray-700 mb-2',
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5',
)
wts = wts.replace("Waste Type", "Waste type")
wrs = "".join(waste_reason_section)
wrs = wrs.replace(
    'block text-sm font-semibold text-gray-700 mb-2',
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5',
)
wrs = wrs.replace("Waste Reason", "Waste reason")

mb = "".join(markup_block)
mb = mb.replace(
    'className="w-full xl:col-span-2 xl:row-start-2 xl:col-start-9"',
    'className="w-full"',
)
mb = mb.replace(
    'className="w-full xl:col-span-2 xl:row-start-3 xl:col-start-1"',
    'className="w-full"',
)
mb = mb.replace(
    'className="w-full xl:col-span-3 xl:row-start-3 xl:col-start-3"',
    'className="w-full"',
)
mb = mb.replace(
    'block text-sm font-semibold text-gray-700 mb-2">\n                                                Markup Type',
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n                                                Markup type',
)
mb = mb.replace(
    'block text-sm font-semibold text-gray-700 mb-2">\n                                                Markup\n',
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n                                                Markup\n',
)
mb = mb.replace(
    'block text-sm font-semibold text-gray-700 mb-2">\n                                                  VAT Percentage (%)',
    'block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n                                                  VAT percentage (%)',
)

jb = joint_block[:]
for i, ln in enumerate(jb):
    if "xl:col-span-3 xl:row-start-3 xl:col-start-6" in ln:
        jb[i] = (
            '                                              <div className="w-full space-y-2 rounded-lg border border-purple-100 bg-purple-50/40 p-3">\n'
        )
        break

ci = "".join(cost_iife_lines)
end_marker = "                                              })()}"
em = ci.rfind(end_marker)
if em < 0:
    raise SystemExit("cost iife end not found")
ret_start = ci.rfind("                                                return (", 0, em)
closing = ci.rfind("                                                );", 0, em)
if ret_start < 0 or closing < 0 or closing < ret_start:
    raise SystemExit(f"cost return bounds {ret_start} {closing}")
new_ret = (
    "                                                return (\n"
    '                                                  <div className="flex flex-wrap items-center gap-6 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5">\n'
    '                                                    <div>\n'
    '                                                      <p className="text-xs text-gray-500 mb-0.5">Cost/unit</p>\n'
    '                                                      <p className="text-sm font-semibold text-indigo-600">\n'
    "                                                        ₦{formatNumber(roundedCostPerUnit)}\n"
    "                                                      </p>\n"
    "                                                    </div>\n"
    '                                                    <div className="hidden sm:block w-px h-8 bg-gray-200" aria-hidden />\n'
    "                                                    <div>\n"
    '                                                      <p className="text-xs text-gray-500 mb-0.5">Selling price</p>\n'
    '                                                      <p className="text-sm font-semibold text-emerald-600">\n'
    "                                                        ₦{formatNumber(sellingPrice)}\n"
    "                                                      </p>\n"
    "                                                    </div>\n"
    "                                                  </div>\n"
    "                                                );\n"
)
ci_new = ci[:ret_start] + new_ret + ci[closing + len("                                                );"):]

out = []
out.append('                                          <div className="space-y-4">\n')
out.append('                                            <div>\n')
out.append(
    '                                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n'
)
out.append('                                                Product{" "}\n')
out.append('                                                <span className="text-red-500">*</span>\n')
out.append('                                              </label>\n')
out.extend(typeahead)
out.append('                                              <p className="mt-1 text-xs text-gray-500">\n')
out.append('                                                Unit:{" "}\n')
out.append(
    '                                                <span className="font-semibold text-indigo-600">\n'
)
out.append('                                                  {finishedGood.unitOfMeasure ||\n')
out.append('                                                    "N/A"}\n')
out.append('                                                </span>\n')
out.append('                                              </p>\n')
out.append('                                            </div>\n\n')

out.extend(process_block)
out.append('\n')

out.append(
    '                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">\n'
)
out.append('                                              <div>\n')
out.append(
    '                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n'
)
out.append('                                                  Good qty{" "}\n')
out.append(
    '                                                  <span className="text-red-500">*</span>\n'
)
out.append('                                                </label>\n')
out.extend(good_input)
out.append('                                              </div>\n')
out.append('                                              <div>\n')
out.append(
    '                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n'
)
out.append('                                                  Waste qty{" "}\n')
out.append(
    '                                                  <span className="text-red-500">*</span>\n'
)
out.append('                                                </label>\n')
out.extend(waste_qty_input)
out.append('                                              </div>\n')
out.append('                                              <div>\n')
out.append(
    '                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">\n'
)
out.append('                                                  Expiry date\n')
out.append('                                                </label>\n')
out.extend(expiry_inner)
out.append('                                              </div>\n')
out.append('                                            </div>\n\n')

out.append(
    '                                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">\n'
)
out.append('                                              <div>\n')
out.extend(list(wts.splitlines(keepends=True)))
out.append('                                              </div>\n')
out.append('                                              <div className="sm:col-span-2">\n')
out.extend(list(wrs.splitlines(keepends=True)))
out.append('                                              </div>\n')
out.append('                                            </div>\n\n')

out.append('                                            <div\n')
out.append('                                              className={\n')
out.append('                                                "grid grid-cols-1 gap-3 " +\n')
out.append('                                                (shouldShowVatInputForPolicy()\n')
out.append('                                                  ? "sm:grid-cols-3"\n')
out.append('                                                  : "sm:grid-cols-2")\n')
out.append('                                              }\n')
out.append('                                            >\n')
out.append(mb)
out.append('                                            </div>\n\n')

out.extend(jb)
out.append('\n')
out.append(ci_new)
out.append('\n')

out.append('                                            <div className="flex justify-end">\n')
out.append('                                              <button\n')
out.append('                                                type="button"\n')
out.append('                                                onClick={() =>\n')
out.append('                                                  handleRemoveFinishedGood(\n')
out.append('                                                    productionItem.id,\n')
out.append('                                                    finishedGood.id,\n')
out.append('                                                  )\n')
out.append('                                                }\n')
out.append(
    '                                                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"\n'
)
out.append('                                                title="Remove"\n')
out.append('                                              >\n')
out.append('                                                <Trash2 size={16} />\n')
out.append('                                              </button>\n')
out.append('                                            </div>\n')
out.append('                                          </div>\n')

new_block = "".join(out)
new_text = "".join(lines[:start_i]) + new_block + "".join(lines[end_i:])
path.write_text(new_text)
print("OK", path)
