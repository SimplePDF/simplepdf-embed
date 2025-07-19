"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Type, ImageIcon, MousePointer, Check, PenTool, FileText, Loader2 } from "lucide-react"
import { EmbedPDF, useEmbed } from "@simplepdf/react-embed-pdf"
import { Switch } from "@/components/ui/switch"

type ToolType = 'TEXT' | 'BOXED_TEXT' | 'CHECKBOX' | 'PICTURE' | 'SIGNATURE' | null;

export default function PDFEditorUI() {
  const [selectedTool, setSelectedTool] = useState<ToolType>(null)
  const [allowDownload, setAllowDownload] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [toolError, setToolError] = useState<string | null>(null)
  const { embedRef, actions } = useEmbed()

  const handleToolSelect = async (tool: ToolType) => {
    setToolError(null)
    const selectedTool = await actions.selectTool(tool)
    if (!selectedTool.success) {
      console.error(selectedTool.error);
      setToolError("Failed to select tool");
      return;
    }

    setSelectedTool(tool);
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)

    const submitResult = await actions.submit({ downloadCopyOnDevice: allowDownload })

    if (!submitResult.success) {
      console.error(submitResult.error);
      setSubmitError("Failed to submit document");
      return;
    }

    setIsSubmitting(false)

  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* PDF Viewer */}
        <EmbedPDF
        className="w-100 h-screen"
              ref={embedRef}
              companyIdentifier="headless"
              mode="inline"
            />
      </div>

      {/* Right Sidebar */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        {/* Tool Icons */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <div className="flex space-x-2">
              <button
                onClick={() => handleToolSelect(null)}
                className={`p-2 hover:bg-gray-100 rounded border border-gray-200 ${selectedTool === null ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <MousePointer className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleToolSelect("TEXT")}
                className={`p-2 hover:bg-gray-100 rounded border border-gray-200 ${selectedTool === "TEXT" ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <Type className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleToolSelect("CHECKBOX")}
                className={`p-2 hover:bg-gray-100 rounded border border-gray-200 ${selectedTool === "CHECKBOX" ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleToolSelect("SIGNATURE")}
                className={`p-2 hover:bg-gray-100 rounded border border-gray-200 ${selectedTool === "SIGNATURE" ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <PenTool className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleToolSelect("PICTURE")}
                className={`p-2 hover:bg-gray-100 rounded border border-gray-200 ${selectedTool === "PICTURE" ? "bg-blue-100 border-blue-500" : ""}`}
              >
                <ImageIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 flex flex-col">
          {/* Tool Error Display */}
          {toolError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{toolError}</div>
          )}

          <div className="mt-auto space-y-4">
            {/* Download Copy Toggle - smaller and above submit */}
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="allow-download" className="text-gray-600">
                Download copy
              </label>
              <Switch id="allow-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
            </div>

            {/* Submit Error Display */}
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{submitError}</div>
            )}

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-center">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-900">Custom Sidebar Demo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
