import React, { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { Users, Building, LogOut, UserPlus, RefreshCw, Search, Edit, Plus, X } from "lucide-react";

const CONFIG = {
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbw5Vs4zmDWa4MPT1_nl5s-DHXoFXp8Wfdnq067gCDArNOrunhetwt8CUj7ApAcohGR2sw/exec",
  SHEET_NAME: "Whatsapp",
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("users");
  const [usersInfo, setUsersInfo] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptViewMode, setDeptViewMode] = useState("names");

  const getLocalDateStr = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Leave Management State
  const [selectedLeaveUser, setSelectedLeaveUser] = useState(null);
  const [leaveTasks, setLeaveTasks] = useState([]);
  const [loadingLeaveTasks, setLoadingLeaveTasks] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState(getLocalDateStr());
  const [leaveEndDate, setLeaveEndDate] = useState(getLocalDateStr());
  const [selectedTasks, setSelectedTasks] = useState(new Set());

  // Add Department State
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptAssignee, setNewDeptAssignee] = useState("");
  const [isSubmittingDept, setIsSubmittingDept] = useState(false);

  // Add User State
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    department: "",
    givenBy: "",
    username: "",
    password: "",
    role: "user",
    email: "",
    number: ""
  });
  const [isSubmittingUser, setIsSubmittingUser] = useState(false);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=${CONFIG.SHEET_NAME}&action=fetch`);
      if (!response.ok) {
        throw new Error(`Failed to fetch data: ${response.status}`);
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = text.substring(jsonStart, jsonEnd + 1);
          data = JSON.parse(jsonString);
        } else {
          throw new Error("Invalid JSON response from server");
        }
      }

      let rows = [];
      if (data.table && data.table.rows) {
        rows = data.table.rows;
      } else if (Array.isArray(data)) {
        rows = data;
      } else if (data.values) {
        rows = data.values.map((row) => ({ c: row.map((val) => ({ v: val })) }));
      }

      const usersList = [];
      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return; // Skip header
        let rowValues = [];
        if (row.c) {
          rowValues = row.c.map((cell) => (cell && cell.v !== undefined ? cell.v : ""));
        } else if (Array.isArray(row)) {
          rowValues = row;
        } else {
          return;
        }

        usersList.push({
          department: rowValues[0] || "-",
          givenBy: rowValues[1] || "-",
          username: rowValues[2] || "-",
          password: rowValues[3] || "-",
          role: rowValues[4] || "-",
          email: rowValues[5] || "-",
          number: rowValues[6] || "-",
        });
      });

      setUsersInfo(usersList);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load user data: " + err.message);
      setLoading(false);
    }
  };

  const parseGoogleSheetDate = (v) => {
    if (!v) return "";
    
    // Handle Google Sheets Date(...) format
    if (typeof v === "string" && v.startsWith("Date(")) {
      const match = /Date\((\d+),(\d+),(\d+)\)/.exec(v);
      if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        return `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
      }
    }
    
    // Handle ISO strings or other date formats
    const d = new Date(v);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return String(v);
  };

  const fetchUserTasks = async (username) => {
    try {
      setLoadingLeaveTasks(true);
      const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?sheet=Checklist&action=fetch`);
      if (!response.ok) throw new Error("Failed to fetch tasks");
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        const jsonStart = text.indexOf("{");
        const jsonEnd = text.lastIndexOf("}");
        data = JSON.parse(text.substring(jsonStart, jsonEnd + 1));
      }
      
      let rows = data.table?.rows || data.values?.map((row) => ({ c: row.map((val) => ({ v: val })) })) || data;
      const tasks = [];
      
      rows.forEach((row, rowIndex) => {
        if (rowIndex === 0) return;
        let rowValues = row.c ? row.c.map(cell => cell?.v || "") : row;
        
        const taskUsername = rowValues[4] || "";
        if (taskUsername.toLowerCase() === username.toLowerCase()) {
           const actualDate = rowValues[10];
           const adminDone = rowValues[15];
           const isLeave = rowValues[16];
           
           if (!actualDate && adminDone !== "Admin Done" && !String(isLeave).toLowerCase().includes("leave")) {
             tasks.push({
               taskId: rowValues[1] || "",
               description: rowValues[5] || "",
               date: parseGoogleSheetDate(rowValues[6]),
               rowIndex: rowIndex + 1
             });
           }
        }
      });
      setLeaveTasks(tasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLeaveTasks(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = usersInfo.filter(user => 
    Object.values(user).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const uniqueDepartments = Array.from(
    new Set(usersInfo.map(user => user.department).filter(dep => dep && dep !== "-"))
  ).sort();

  const parseDateForFilter = (dateStr) => {
    if (!dateStr) return null;
    let cleanStr = String(dateStr).includes(" ") ? String(dateStr).split(" ")[0] : String(dateStr);
    const parts = cleanStr.split("/");
    if (parts.length === 3) {
      return new Date(parts[2], parts[1] - 1, parts[0]);
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    return null;
  };

  const filteredLeaveTasks = leaveTasks.filter(task => {
    if (!leaveStartDate && !leaveEndDate) return true;
    
    const taskDate = parseDateForFilter(task.date);
    if (!taskDate) return true;

    if (leaveStartDate) {
      const start = new Date(leaveStartDate);
      start.setHours(0, 0, 0, 0);
      if (taskDate < start) return false;
    }
    if (leaveEndDate) {
      const end = new Date(leaveEndDate);
      end.setHours(23, 59, 59, 999);
      if (taskDate > end) return false;
    }
    return true;
  });

  const handleAddDepartmentSubmit = async () => {
    if (!newDeptName) {
      alert("Please provide a department name.");
      return;
    }
    
    setIsSubmittingDept(true);
    try {
      const formPayload = new FormData();
      formPayload.append("sheetName", CONFIG.SHEET_NAME);
      formPayload.append("action", "insert");
      
      const row = [
        newDeptName,
        newDeptAssignee,
        "", // Username
        "", // password
        "", // Role
        "", // Email
        ""  // Number
      ];
      
      formPayload.append("rowData", JSON.stringify(row));

      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formPayload,
        mode: "no-cors",
      });
      
      setNewDeptName("");
      setNewDeptAssignee("");
      setIsAddDeptModalOpen(false);
      
      setTimeout(() => {
        fetchUsers();
      }, 1500);
      
      alert("Department added successfully!");
    } catch (error) {
      console.error("Error creating department:", error);
      alert("Failed to create department. Please try again.");
    } finally {
      setIsSubmittingDept(false);
    }
  };

  const handleAddUserSubmit = async () => {
    if (!newUser.username || !newUser.password) {
      alert("Username and Password are required.");
      return;
    }
    
    setIsSubmittingUser(true);
    try {
      const formPayload = new FormData();
      formPayload.append("sheetName", CONFIG.SHEET_NAME);
      formPayload.append("action", "insert");
      
      const row = [
        newUser.department,
        newUser.givenBy,
        newUser.username,
        newUser.password,
        newUser.role,
        newUser.email,
        newUser.number
      ];
      
      formPayload.append("rowData", JSON.stringify(row));

      await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: "POST",
        body: formPayload,
        mode: "no-cors",
      });
      
      setNewUser({
        department: "",
        givenBy: "",
        username: "",
        password: "",
        role: "user",
        email: "",
        number: ""
      });
      setIsAddUserModalOpen(false);
      
      setTimeout(() => {
        fetchUsers();
      }, 1500);
      
      alert("User added successfully!");
    } catch (error) {
      console.error("Error creating user:", error);
      alert("Failed to create user. Please try again.");
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleLeaveSubmit = async () => {
    if (selectedTasks.size === 0) {
      alert("Please select at least one task.");
      return;
    }

    setIsSubmittingLeave(true);
    try {
      // Find the tasks that are selected to get their row indices
      const selectedTasksToSubmit = filteredLeaveTasks.filter(task => selectedTasks.has(task.taskId));
      
      // We use the generic "update" action because the "updateAdminDone" action in Apps Script 
      // is hardcoded to Column P (16). Using "update" lets us target Column Q (17) via array index.
      for (const task of selectedTasksToSubmit) {
        const formPayload = new FormData();
        formPayload.append("sheetName", "Checklist");
        formPayload.append("action", "update");
        formPayload.append("rowIndex", task.rowIndex);
        
        // Helper to format YYYY-MM-DD to DD/MM/YYYY
        const formatDateForSheet = (dateStr) => {
          if (!dateStr) return "";
          const [year, month, day] = dateStr.split("-");
          return `${day}/${month}/${year}`;
        };

        const startDateFormatted = formatDateForSheet(leaveStartDate);
        const endDateFormatted = formatDateForSheet(leaveEndDate);
        const leaveString = `Leave ${startDateFormatted} - ${endDateFormatted}`;

        // Array index 16 corresponds to Column 17, which is Column Q (Leave)
        const rowUpdateArr = Array(17).fill("");
        rowUpdateArr[16] = leaveString; 
        
        formPayload.append("rowData", JSON.stringify(rowUpdateArr));

        await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: "POST",
          body: formPayload,
        });
      }

      alert("Tasks marked as leave successfully!");
      const currentUsername = selectedLeaveUser?.username;
      setSelectedTasks(new Set());
      setSelectedLeaveUser(null);
      
      if (currentUsername) {
        fetchUserTasks(currentUsername);
      }
    } catch (error) {
      console.error("Error submitting leave tasks:", error);
      alert("Failed to submit leave tasks. Please try again.");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-purple-700">User Management System</h1>
            <p className="text-gray-500 text-sm mt-1">Manage your organization's users and departments</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === "users"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              <Users className="w-4 h-4 mr-2" /> Users
            </button>
            <button
              onClick={() => setActiveTab("departments")}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === "departments"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              <Building className="w-4 h-4 mr-2" /> Departments
            </button>
            <button
              onClick={() => setActiveTab("leave")}
              className={`flex items-center px-4 py-2 rounded-md text-sm font-medium ${
                activeTab === "leave"
                  ? "bg-purple-600 text-white"
                  : "bg-white text-purple-600 border border-purple-200 hover:bg-purple-50"
              }`}
            >
              <LogOut className="w-4 h-4 mr-2" /> Leave
            </button>
            {activeTab !== "leave" && (
              <button
                onClick={() => {
                  if (activeTab === "departments") {
                    setIsAddDeptModalOpen(true);
                  } else {
                    setIsAddUserModalOpen(true);
                  }
                }}
                className="flex items-center px-4 py-2 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 ml-2"
              >
                {activeTab === "departments" ? (
                  <><Plus className="w-4 h-4 mr-2" /> Add Department</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Add User</>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-purple-100 shadow-md">
          {activeTab === "users" && (
            <div className="flex flex-col">
              <div className="p-4 border-b border-purple-100 flex flex-col md:flex-row justify-between items-center bg-purple-50/50 rounded-t-lg">
                <div className="flex items-center space-x-2 text-purple-800 font-medium pb-2 md:pb-0">
                  <span className="p-2 bg-purple-100 rounded-md">
                    <Users className="w-5 h-5 text-purple-600" />
                  </span>
                  <span>User Directory</span>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto">
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      placeholder="Filter by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-full text-sm shadow-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                  <button onClick={fetchUsers} disabled={loading} className="p-2 text-purple-600 hover:bg-purple-100 rounded-full transition-colors border border-purple-200 bg-white">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-purple-800 font-bold bg-gray-50">
                      <th className="px-6 py-4 font-semibold tracking-wider">Department</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Given By</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Doer's Name</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">Password</th>
                      <th className="px-6 py-4 font-semibold tracking-wider text-center">Role</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">ID/Email</th>
                      <th className="px-6 py-4 font-semibold tracking-wider text-right">Number</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          Loading user data...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-red-500">
                          {error}
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-700">{user.department}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{user.givenBy}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{user.username}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 font-mono text-xs">{user.password}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              String(user.role).toLowerCase() === 'admin' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 text-right">{user.number}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "departments" && (
            <div className="flex flex-col">
              <div className="p-4 border-b border-purple-100 flex flex-col md:flex-row justify-between items-center bg-purple-50/50 rounded-t-lg">
                <div className="flex items-center space-x-2 text-purple-800 font-medium pb-2 md:pb-0">
                  <span className="p-2 bg-purple-100 rounded-md">
                    <Building className="w-5 h-5 text-purple-600" />
                  </span>
                  <span>Department Management</span>
                </div>
                <div className="flex items-center space-x-3 w-full md:w-auto mt-2 md:mt-0">
                  <div className="flex bg-white rounded-full border border-purple-200 p-1">
                     <button 
                       onClick={() => setDeptViewMode("names")}
                       className={`px-4 py-1 text-sm rounded-full font-medium transition-colors ${deptViewMode === "names" ? "bg-purple-600 text-white" : "text-purple-600 hover:bg-purple-50"}`}>
                       Names
                     </button>
                     <button 
                       onClick={() => setDeptViewMode("assignees")}
                       className={`px-4 py-1 text-sm rounded-full font-medium transition-colors ${deptViewMode === "assignees" ? "bg-purple-600 text-white" : "text-purple-600 hover:bg-purple-50"}`}>
                       Assignees
                     </button>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead>
                    <tr className="border-b border-gray-200 text-xs uppercase text-purple-800 font-bold bg-gray-50">
                      <th className="px-6 py-4 font-semibold tracking-wider w-16">#</th>
                      <th className="px-6 py-4 font-semibold tracking-wider">DEPARTMENT NAME</th>
                      <th className="px-6 py-4 font-semibold tracking-wider text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-12 text-center text-gray-500">
                          Loading departments...
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-12 text-center text-red-500">
                          {error}
                        </td>
                      </tr>
                    ) : uniqueDepartments.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="px-6 py-12 text-center text-gray-500">
                          No departments found.
                        </td>
                      </tr>
                    ) : (
                      uniqueDepartments.map((dept, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-700">{idx + 1}</td>
                          <td className="px-6 py-4 text-sm font-bold text-gray-900">{dept}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-purple-500 hover:text-purple-800 hover:bg-purple-100 p-2 rounded-md transition-colors inline-block">
                              <Edit className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "leave" && (
            <div className="flex flex-col">
              <div className="p-4 border-b border-purple-100 flex justify-between items-center bg-purple-50/50 rounded-t-lg">
                <div className="flex items-center space-x-2 text-purple-800 font-medium">
                  <span className="p-2 bg-purple-100 rounded-md">
                    <LogOut className="w-5 h-5 text-purple-600" />
                  </span>
                  <span>Leave Management</span>
                </div>
                <button onClick={fetchUsers} className="p-2 text-purple-600 hover:bg-purple-100 rounded-full transition-colors border border-purple-200 bg-white">
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="overflow-x-auto h-[600px] overflow-y-auto w-full">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm outline outline-1 outline-gray-200">
                    <tr className="text-xs uppercase text-gray-500 font-bold">
                      <th className="px-6 py-4 w-12 text-center bg-gray-50"></th>
                      <th className="px-6 py-4 bg-gray-50">DEPARTMENT</th>
                      <th className="px-6 py-4 bg-gray-50">GIVEN BY</th>
                      <th className="px-6 py-4 bg-gray-50">NAME</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          Loading user data...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          No users found.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, idx) => (
                        <tr key={idx} className="hover:bg-purple-50/50 transition-colors">
                          <td className="px-6 py-4 text-center">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-white bg-blue-500 border-none rounded checked:bg-blue-600 focus:ring-0 checked:appearance-auto" 
                              checked={selectedLeaveUser?.username === user.username}
                              onChange={() => {
                                if (selectedLeaveUser?.username === user.username) {
                                  setSelectedLeaveUser(null);
                                  setLeaveTasks([]);
                                  setSelectedTasks(new Set());
                                } else {
                                  setSelectedLeaveUser(user);
                                  fetchUserTasks(user.username);
                                  setLeaveStartDate(getLocalDateStr());
                                  setLeaveEndDate(getLocalDateStr());
                                  setSelectedTasks(new Set());
                                }
                              }}
                            />
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{user.department}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{user.givenBy}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">{user.username}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab !== "users" && activeTab !== "departments" && activeTab !== "leave" && (
            <div className="p-12 text-center text-gray-500 flex flex-col items-center justify-center space-y-3">
              <div className="p-3 bg-purple-50 rounded-full">
                {(activeTab === "adduser" || activeTab === "adddepartment") && <UserPlus className="w-8 h-8 text-purple-400" />}
              </div>
              <p className="text-lg font-medium text-gray-700">Under Development</p>
              <p className="max-w-md text-sm">
                The {activeTab === "adddepartment" ? "add department" : activeTab} section is currently being built. Please check back later for updates.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Leave Modal */}
      {selectedLeaveUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">
                Transfer Tasks for <span className="text-purple-600">{selectedLeaveUser.username}</span>
              </h2>
              <button 
                onClick={() => setSelectedLeaveUser(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Start Date</label>
                  <input 
                    type="date" 
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">End Date</label>
                  <input 
                    type="date" 
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-purple-500 focus:border-purple-500"
                  />
                </div>
              </div>
              
              <div className="flex flex-col flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <span className="text-xs font-bold text-gray-700 uppercase">
                    Tasks to Assign ({filteredLeaveTasks.length})
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-0">
                  {loadingLeaveTasks ? (
                    <div className="flex items-center justify-center h-32">
                      <RefreshCw className="w-6 h-6 text-purple-600 animate-spin" />
                    </div>
                  ) : filteredLeaveTasks.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                      No tasks found for the selected dates.
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse relative">
                      <thead className="bg-white sticky top-0 z-10 shadow-sm outline outline-1 outline-gray-200">
                        <tr className="text-xs uppercase text-gray-500 font-bold">
                          <th className="px-4 py-3 w-12 text-center bg-white">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 text-purple-600 rounded border-gray-300"
                              checked={filteredLeaveTasks.length > 0 && selectedTasks.size === filteredLeaveTasks.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTasks(new Set(filteredLeaveTasks.map(t => t.taskId)));
                                } else {
                                  setSelectedTasks(new Set());
                                }
                              }}
                            />
                          </th>
                          <th className="px-4 py-3 bg-white">Task ID</th>
                          <th className="px-4 py-3 bg-white">Description</th>
                          <th className="px-4 py-3 bg-white">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredLeaveTasks.map((task, idx) => (
                          <tr key={idx} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-center">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 text-purple-600 rounded border-gray-300"
                                checked={selectedTasks.has(task.taskId)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedTasks);
                                  if (e.target.checked) newSet.add(task.taskId);
                                  else newSet.delete(task.taskId);
                                  setSelectedTasks(newSet);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-medium">{task.taskId}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[200px] md:max-w-xs">{task.description}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{task.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            
            <div className="border-t border-gray-100 p-6 flex justify-between items-center bg-gray-50 rounded-b-lg">
              <span className="text-sm text-gray-500">
                {selectedTasks.size === 0 ? "No tasks selected" : `${selectedTasks.size} task(s) selected`}
              </span>
              <div className="space-x-3">
                <button 
                  onClick={() => setSelectedLeaveUser(null)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 bg-white rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  disabled={selectedTasks.size === 0 || isSubmittingLeave}
                  onClick={handleLeaveSubmit}
                  className="px-6 py-2 bg-gray-200 text-gray-600 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 transition-colors inline-flex items-center"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isSubmittingLeave ? 'animate-spin' : ''}`} />
                  {isSubmittingLeave ? "Submitting..." : "Leave"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Department Modal */}
      {isAddDeptModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="bg-purple-600 p-6 flex justify-between items-start">
              <div className="text-white">
                <h2 className="text-2xl font-bold mb-1">New Department</h2>
                <p className="text-white/80 text-sm">Add a functional group</p>
              </div>
              <button 
                onClick={() => setIsAddDeptModalOpen(false)}
                className="bg-white/20 hover:bg-white/30 rounded-full p-1 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-6 bg-purple-50/30">
              <div>
                <label className="block text-xs font-bold text-purple-700 uppercase mb-2">
                  Department Name *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Sales, HR"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full border border-purple-100 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-700 uppercase mb-2">
                  Given By (Assignee)
                </label>
                <input 
                  type="text" 
                  placeholder="Enter name"
                  value={newDeptAssignee}
                  onChange={(e) => setNewDeptAssignee(e.target.value)}
                  className="w-full border border-purple-100 rounded-xl py-3 px-4 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white shadow-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button 
                  onClick={() => setIsAddDeptModalOpen(false)}
                  className="py-3 px-4 bg-white border border-purple-100 text-purple-600 font-bold rounded-xl shadow-sm hover:bg-purple-50 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddDepartmentSubmit}
                  disabled={isSubmittingDept || !newDeptName}
                  className="py-3 px-4 bg-purple-600 text-white font-bold rounded-xl shadow-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isSubmittingDept ? "Creating..." : "Create Department"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-purple-600 p-6 flex justify-between items-start">
              <div className="text-white">
                <h2 className="text-2xl font-bold mb-1">New User</h2>
                <p className="text-white/80 text-sm">Create a new system user</p>
              </div>
              <button 
                onClick={() => setIsAddUserModalOpen(false)}
                className="bg-white/20 hover:bg-white/30 rounded-full p-1 text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 space-y-4 bg-purple-50/30 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Department</label>
                  <input 
                    type="text" 
                    value={newUser.department}
                    onChange={(e) => setNewUser({...newUser, department: e.target.value})}
                    className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Given By</label>
                  <input 
                    type="text" 
                    value={newUser.givenBy}
                    onChange={(e) => setNewUser({...newUser, givenBy: e.target.value})}
                    className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Username *</label>
                <input 
                  type="text" 
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Password *</label>
                <input 
                  type="password" 
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Role</label>
                  <select 
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Number</label>
                  <input 
                    type="text" 
                    value={newUser.number}
                    onChange={(e) => setNewUser({...newUser, number: e.target.value})}
                    className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-700 uppercase mb-2">Email</label>
                <input 
                  type="email" 
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full border border-purple-100 rounded-xl py-2 px-4 text-sm focus:ring-2 focus:ring-purple-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 sticky bottom-0 bg-transparent">
                <button 
                  onClick={() => setIsAddUserModalOpen(false)}
                  className="py-3 px-4 bg-white border border-purple-100 text-purple-600 font-bold rounded-xl shadow-sm hover:bg-purple-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddUserSubmit}
                  disabled={isSubmittingUser || !newUser.username || !newUser.password}
                  className="py-3 px-4 bg-purple-600 text-white font-bold rounded-xl shadow-md hover:bg-purple-700 disabled:opacity-50"
                >
                  {isSubmittingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
