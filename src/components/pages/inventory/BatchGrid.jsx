import { useCallback, useEffect, useState } from "react"
import { BatchCard } from "./BatchCard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSelector } from "react-redux"
import { _postApi } from "@/redux/actions/api"

// Sample batch data
const batchData = [
  {
    id: "B-1001",
    name: "Raw Material A",
    quantity: 500,
    date: "2024-03-25",
    status: "processed",
    grnNumber: "GRN-7845",
  },
  {
    id: "B-1002",
    name: "Component X",
    quantity: 250,
    date: "2024-03-24",
    status: "pending",
    grnNumber: "GRN-7846",
  },
  {
    id: "B-1004",
    name: "Material Z",
    quantity: 750,
    date: "2024-03-22",
    status: "processed",
    grnNumber: "GRN-7848",
  },
  {
    id: "B-1005",
    name: "Component B",
    quantity: 300,
    date: "2024-03-21",
    status: "pending",
    grnNumber: "GRN-7849",
  },
  {
    id: "B-1006",
    name: "Raw Material C",
    quantity: 450,
    date: "2024-03-20",
    status: "processed",
    grnNumber: "GRN-7850",
  },
]




export default function BatchGrid() {
  const [activeTab, setActiveTab] = useState("all")
  const [loading, setLoading] = useState(true)
  const [batch, setBatch] = useState([])
  const { activeBusiness, user } = useSelector((state) => state.auth);

  const getPR = useCallback(() => {
    _postApi(
      `/account/purchase-requisition`,
      {
        query_type: "select-approved",
        requisitor: user.fullname,
        facilityId: activeBusiness.id,
      },
      (data) => {
        setLoading(false);
        if (data.success) {
          setBatch(data.results);
        }
      },
      (err) => {
        setLoading(false);
        console.log(err);
      }
    );
  }, [activeBusiness.id, user.id]);

  // Filter batches based on active tab
  const filteredBatches = batch.filter((batch) => {
    if (activeTab === "all") return true
    if (activeTab === "Approved") return batch.status === "Approved"
    if (activeTab === "processed") return batch.status === "processed"
    return true
  })

  // Count batches by status
  const pendingCount = batch.filter((batch) => batch.status === "Approved").length
  const processedCount = batch.filter((batch) => batch.status === "processed").length
  const allCount = batch.length

  useEffect(() => {
      getPR();
    }, [getPR]);

  return (
    <div className="container mx-auto p-4">
      {/* {JSON.stringify(batch)} */}
      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
      <div className="flex justify-end mb-4">
        <TabsList className="grid grid-cols-3 max-w-md">
          <TabsTrigger value="all">
            All
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {allCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pendingCount}
            </span>
          </TabsTrigger>
          <TabsTrigger value="processed">
            Processed
            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
              {processedCount}
            </span>
          </TabsTrigger>
        </TabsList>
      </div>

        <TabsContent value="all" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} {...batch} />
            ))}
          </div>
          {filteredBatches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No batches found</div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} {...batch} />
            ))}
          </div>
          {filteredBatches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No pending batches found</div>
          )}
        </TabsContent>

        <TabsContent value="processed" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBatches.map((batch) => (
              <BatchCard key={batch.id} {...batch} />
            ))}
          </div>
          {filteredBatches.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No processed batches found</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}