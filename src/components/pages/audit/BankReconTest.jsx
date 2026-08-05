import  { useState } from "react";
import { apiURL } from "@/redux/actions/api";

function BankReconTest() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setLoading(true);
    try {
      const res = await fetch(`${apiURL}/audit/upload-statement`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      // console.log("API Response:", data);

      if (data.success) {
        setResult(data.transactions);
      } else {
        alert("Error: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong");
    }
    setLoading(false);
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4">Upload Bank Statement (PDF)</h2>
      <input type="file" accept="application/pdf" onChange={handleFileUpload} />

      {loading && <p className="mt-4 text-blue-500">Processing PDF...</p>}

      {result && (
        <div className="mt-6 border p-4 rounded bg-gray-50 overflow-auto max-h-[500px]">
          <h3 className="text-lg font-semibold mb-2">Parsed Result (PDF to table)</h3>
          <pre className="text-sm bg-white p-3 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default BankReconTest;
