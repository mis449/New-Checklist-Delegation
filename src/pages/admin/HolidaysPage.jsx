"use client"
import { useState, useEffect, useCallback } from "react"
import { Calendar as CalendarIcon, RefreshCw, Briefcase, CalendarDays, Edit, X } from "lucide-react"
import axios from "axios"
import AdminLayout from "../../components/layout/AdminLayout"

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbw5Vs4zmDWa4MPT1_nl5s-DHXoFXp8Wfdnq067gCDArNOrunhetwt8CUj7ApAcohGR2sw/exec",
  WORKING_DAYS_SHEET: "Working Day Calendar",
  HOLIDAYS_SHEET: "Holiday List"
}

const formatDate = (dateValue) => {
  if (!dateValue) return ""
  try {
    // If it's a date object or string, try to format it
    const date = new Date(dateValue)
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, "0")
      const month = String(date.getMonth() + 1).padStart(2, "0")
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }
  } catch (e) {
    console.error("Date formatting error:", e)
  }
  return dateValue // Fallback to original
}

export default function HolidaysPage() {
  const [activeTab, setActiveTab] = useState("working-days")
  const [workingDays, setWorkingDays] = useState([])
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // NEW: Modal and Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    date: "",
    reason: "",
    rowIndex: null
  })

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const wdResponse = await axios.get(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.WORKING_DAYS_SHEET}&action=fetch`)
      if (wdResponse.data && wdResponse.data.table && wdResponse.data.table.rows) {
        const rows = wdResponse.data.table.rows
        const formattedWD = rows.slice(1).map((row, index) => {
          const cells = row.c || []
          return {
            sNo: index + 1,
            date: cells[0]?.v || "",
            day: cells[1]?.v || "",
            weekNum: cells[2]?.v || "",
            month: cells[3]?.v || ""
          }
        }).filter(item => item.date)
        setWorkingDays(formattedWD)
      }

      const hResponse = await axios.get(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.HOLIDAYS_SHEET}&action=fetch`)
      if (hResponse.data && hResponse.data.table && hResponse.data.table.rows) {
        const rows = hResponse.data.table.rows
        const formattedH = rows.slice(1).map((row, index) => {
          const cells = row.c || []
          return {
            sNo: index + 1,
            rowIndex: index + 2, // 1-based, skip header
            date: cells[0]?.v || "",
            day: cells[1]?.v || "",
            reason: cells[2]?.v || ""
          }
        }).filter(item => item.date)
        setHolidays(formattedH)
      }
    } catch (err) {
      console.error("Error fetching holiday data:", err)
      setError("Failed to load data. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleOpenAddModal = () => {
    setFormData({ date: "", reason: "", rowIndex: null })
    setIsEditing(false)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (holiday) => {
    // Convert DD/MM/YYYY to YYYY-MM-DD for date input
    let formattedDate = ""
    if (holiday.date) {
      let d = null
      if (typeof holiday.date === "string" && holiday.date.includes("/")) {
        const [day, month, year] = holiday.date.split("/")
        d = new Date(year, month - 1, day)
      } else {
        d = new Date(holiday.date)
      }

      if (d && !isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        formattedDate = `${y}-${m}-${day}`
      }
    }

    setFormData({
      date: formattedDate,
      reason: holiday.reason,
      rowIndex: holiday.rowIndex
    })
    setIsEditing(true)
    setIsModalOpen(true)
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    if (!formData.date || !formData.reason) return

    try {
      setIsSubmitting(true)

      // Format date to DD/MM/YYYY for Google Sheets
      const [y, m, d] = formData.date.split("-")
      const formattedDate = `${d}/${m}/${y}`
      const dayOfWeek = new Date(formData.date).toLocaleDateString('en-US', { weekday: 'short' });

      const payload = new FormData()
      payload.append("sheetName", CONFIG.HOLIDAYS_SHEET)

      const rowValues = [formattedDate, dayOfWeek, formData.reason]

      if (isEditing) {
        payload.append("action", "update")
        payload.append("rowIndex", formData.rowIndex)
        payload.append("rowData", JSON.stringify(rowValues))
      } else {
        payload.append("action", "insert")
        payload.append("rowData", JSON.stringify(rowValues))
      }

      await axios.post(CONFIG.APPS_SCRIPT_URL, payload)
      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error("Error submitting holiday:", err)
      alert("Failed to save holiday. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderWorkingDaysTable = () => (
    <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10 bg-purple-50">
          <tr className="text-purple-900 border-b border-purple-100">
            <th className="px-6 py-4 font-semibold text-sm">S.No</th>
            <th className="px-6 py-4 font-semibold text-sm">Working Dates</th>
            <th className="px-6 py-4 font-semibold text-sm">Day</th>
            <th className="px-6 py-4 font-semibold text-sm">Week Num</th>
            <th className="px-6 py-4 font-semibold text-sm">Month</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {workingDays.length > 0 ? (
            workingDays.map((day) => (
              <tr key={day.sNo} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-700">{day.sNo}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(day.date)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{day.day}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{day.weekNum}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{day.month}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="px-6 py-10 text-center text-gray-500">No records found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  const renderHolidaysTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-purple-50 text-purple-900 border-b border-purple-100">
            <th className="px-6 py-4 font-semibold text-sm">S.No</th>
            <th className="px-6 py-4 font-semibold text-sm">Date</th>
            <th className="px-6 py-4 font-semibold text-sm">Day</th>
            <th className="px-6 py-4 font-semibold text-sm">Holiday (Reason)</th>
            <th className="px-6 py-4 font-semibold text-sm text-center">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {holidays.length > 0 ? (
            holidays.map((holiday) => (
              <tr key={holiday.sNo} className="hover:bg-purple-50/30 transition-colors">
                <td className="px-6 py-4 text-sm text-gray-700">{holiday.sNo}</td>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{formatDate(holiday.date)}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{holiday.day}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{holiday.reason}</td>
                <td className="px-6 py-4 text-sm text-center">
                  <button
                    onClick={() => handleOpenEditModal(holiday)}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="px-6 py-10 text-center text-gray-500">No holidays found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )

  return (
    <AdminLayout>
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        {/* Header and Tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200 shadow-inner">
            <button
              onClick={() => setActiveTab("working-days")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === "working-days"
                  ? "bg-purple-600 bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                  : "text-gray-600 hover:bg-white/50 text-gray-600"
              }`}
            >
              <Briefcase className={`w-4 h-4 ${activeTab === "working-days" ? "text-white" : "text-gray-500"}`} />
              <span className={activeTab === "working-days" ? "text-white" : ""}>Working Days</span>
            </button>
            <button
              onClick={() => setActiveTab("holidays")}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === "holidays"
                  ? "bg-purple-600 bg-gradient-to-r from-purple-300 to-pink-700 text-white shadow-md"
                  : "text-gray-600 hover:bg-white/50 text-gray-600"
              }`}
            >
              <CalendarIcon className={`w-4 h-4 ${activeTab === "holidays" ? "text-white" : "text-gray-500"}`} />
              <span className={activeTab === "holidays" ? "text-white" : ""}>Holidays</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "holidays" && (
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-purple-700 transition-all"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Add Holiday</span>
              </button>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2.5 bg-white rounded-xl shadow-sm border border-gray-100 text-gray-500 hover:text-purple-600 hover:border-purple-100 transition-all disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* content Card */}
        <div className="bg-white rounded-2xl shadow-xl shadow-purple-500/5 border border-purple-100 overflow-hidden">
          <div className="p-6 border-b border-gray-50">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-600 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white shadow-lg shadow-purple-200">
                {activeTab === "working-days" ? (
                  <Briefcase className="w-6 h-6" />
                ) : (
                  <CalendarDays className="w-6 h-6" />
                )}
              </div>
              <div>
                <h2 className="text-xl font-bold text-purple-600">
                  {activeTab === "working-days" ? "Working Days" : "Holidays"}
                </h2>
                <p className="text-sm text-gray-500">
                  {activeTab === "working-days"
                    ? `${workingDays.length} records`
                    : `${holidays.length} records`}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 animate-pulse font-medium">Fetching records...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-4">
              <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block max-w-md mx-auto border border-red-100">
                <p className="text-sm font-medium">{error}</p>
              </div>
              <br />
              <button
                onClick={fetchData}
                className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Retry Fetch
              </button>
            </div>
          ) : (
            <div className="min-h-[400px]">
              {activeTab === "working-days" ? renderWorkingDaysTable() : renderHolidaysTable()}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-gradient-to-r from-purple-600 to-pink-600 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {isEditing ? "Edit Holiday" : "Add New Holiday"}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/80 hover:text-white transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700">Holiday Reason</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali, Republic Day"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl text-sm font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-8 py-3 rounded-xl text-sm font-bold text-white bg-purple-600 shadow-lg hover:bg-purple-700 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : isEditing ? "Update Holiday" : "Save Holiday"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
