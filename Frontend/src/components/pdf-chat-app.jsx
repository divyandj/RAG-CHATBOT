"use client"

import { useState, useEffect } from "react"
import { FileText, AlertCircle, CheckCircle, Plus, Menu, X, ChevronDown, ChevronUp, RotateCcw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import ChatInterface from "@/components/chat-interface"
import FileUpload from "@/components/file-upload"
import ChatList from "@/components/chat-list"

export default function PDFChatApp() {
  const [apiStatus, setApiStatus] = useState("checking")
  const [uploadStatus, setUploadStatus] = useState("idle")
  const [resetStatus, setResetStatus] = useState("idle")
  const [errorMessage, setErrorMessage] = useState(null)
  const [chatHistory, setChatHistory] = useState([])
  const [chats, setChats] = useState([])
  const [currentChat, setCurrentChat] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [summaryOpen, setSummaryOpen] = useState(true)

  const isMobile = useMediaQuery("(max-width: 768px)")

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false)
      setSummaryOpen(false)
    } else {
      setSidebarOpen(true)
      setSummaryOpen(true)
    }
  }, [isMobile])

  useEffect(() => {
    const checkApiHealth = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        const response = await fetch("http://localhost:5000/api/health", { signal: controller.signal })
        clearTimeout(timeoutId)
        const data = await response.json()
        setApiStatus(data.status === "healthy" ? "healthy" : "down")
      } catch (error) {
        setApiStatus("down")
        setErrorMessage(
          error.name === "AbortError"
            ? "API request timed out"
            : "API is not available. Please ensure the server is running."
        )
      }
    }

    checkApiHealth()
  }, [])

  useEffect(() => {
    if (apiStatus === "healthy") {
      fetchChats()
    }
  }, [apiStatus])

  const fetchChats = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch("http://localhost:5000/api/chats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setChats(data.chats || [])
      }
    } catch (error) {
      console.error("Error fetching chats:", error)
    }
  }

  const createNewChat = () => {
    setChatHistory([])
    setCurrentChat(null)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  const selectChat = async (chatId) => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch(`http://localhost:5000/api/chats/${chatId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setChatHistory(data.chat.history || [])
        setCurrentChat(data.chat)
        if (isMobile) {
          setSidebarOpen(false)
        }
      }
    } catch (error) {
      console.error("Error fetching chat:", error)
      setErrorMessage("Failed to load chat history")
    }
  }

  const saveCurrentChat = async (chatName) => {
    if (chatHistory.length === 0) return

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        setErrorMessage("Please log in to save chats")
        return
      }

      const userId = JSON.parse(atob(token.split(".")[1])).userId
      const chatId = currentChat?.chatId || `chat_${Date.now()}`

      const response = await fetch("http://localhost:5000/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          chatId,
          chatName: chatName || `Chat ${chats.length + 1}`,
          history: chatHistory,
        }),
      })

      if (response.ok) {
        fetchChats()
      } else {
        setErrorMessage("Failed to save chat")
      }
    } catch (error) {
      console.error("Error saving chat:", error)
      setErrorMessage("Failed to save chat")
    }
  }

  const handleResetVectorstore = async () => {
    setResetStatus("loading")
    setErrorMessage(null)

    try {
      const response = await fetch("http://localhost:5000/api/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        setResetStatus("success")
        setUploadStatus("idle")
        setChatHistory([])
        setCurrentChat(null)
        setTimeout(() => setResetStatus("idle"), 3000) // Reset status after 3 seconds
      } else {
        const data = await response.json()
        setResetStatus("error")
        setErrorMessage(data.error || "Failed to reset vectorstore")
      }
    } catch (error) {
      setResetStatus("error")
      setErrorMessage("Error resetting vectorstore")
      console.error("Error resetting vectorstore:", error)
    }
  }

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen)
  }

  const toggleSummary = () => {
    setSummaryOpen(!summaryOpen)
  }

  const formatPDFSummary = (summary) => {
    const sections = summary.split('\n\n').filter(line => line.trim())
    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          const lines = section.split('\n').filter(line => line.trim())
          const title = lines[0].startsWith('**') ? lines[0].replace(/\*\*/g, '') : lines[0]
          const content = lines.slice(1).join(' ')
          return (
            <div key={index} className="border-l-4 border-primary pl-4">
              <h3 className="text-lg font-semibold text-foreground">{title}</h3>
              {content && (
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">{content}</p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-background overflow-hidden">
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} aria-label="Toggle sidebar">
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <h1 className="text-xl font-bold">PDF Chat</h1>
        <div className="w-10"></div>
      </div>

      {sidebarOpen && (
        <div
          className={`${
            isMobile ? "absolute z-40 top-[61px] bottom-0 left-0 w-[280px]" : "w-[280px] min-w-[280px]"
          } border-r border-border bg-card shadow-sm flex flex-col h-full md:h-screen`}
        >
          <div className="p-4 border-b border-border">
            <Button
              onClick={createNewChat}
              className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ChatList chats={chats} currentChatId={currentChat?.chatId} onSelectChat={selectChat} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden h-[calc(100vh-61px)] md:h-screen">
        <div className="hidden md:flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2">
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h1 className="text-2xl font-bold">PDF Chat Application</h1>
          </div>
          {currentChat && (
            <div className="text-sm text-muted-foreground">
              Current chat: <span className="font-medium">{currentChat.chatName}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-6">
          {apiStatus === "down" && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage || "API is not available. Please ensure the server is running."}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
            <div className="lg:col-span-1">
              <Card className="overflow-hidden border shadow-sm h-full">
                <CardHeader className="bg-muted/70 p-4">
                  <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                    <FileText className="h-5 w-5" />
                    PDF Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <FileUpload
                    apiStatus={apiStatus}
                    setUploadStatus={setUploadStatus}
                    setErrorMessage={setErrorMessage}
                  />
                  <Button
                    variant="outline"
                    onClick={handleResetVectorstore}
                    disabled={resetStatus === "loading" || apiStatus !== "healthy"}
                    className="mt-4 w-full gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    {resetStatus === "loading" ? "Resetting..." : "Reset Vectorstore"}
                  </Button>
                  {uploadStatus === "success" && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 text-green-600 mb-4">
                        <CheckCircle className="h-4 w-4" />
                        <span>PDFs processed successfully!</span>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={toggleSummary}
                        class adenine="flex items-center gap-2 mb-2"
                      >
                        {summaryOpen ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Hide Summary
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Show Summary
                          </>
                        )}
                      </Button>
                      {summaryOpen && (
                        <div className="bg-muted/50 p-4 rounded-md border border-muted">
                          {formatPDFSummary(
                            "Here's a summary of both experiments:\n\n**Experiment 4: Implementation and analysis of S-DES on Plain Text / Image**\nIn this experiment, the students implemented and analyzed the Simplified Data Encryption Standard (S-DES) algorithm on both plain text and images. They generated a 10-bit random key, applied the S-DES algorithm to encrypt the plain text and image, and then decrypted the encrypted data using the same key. The experiment aimed to demonstrate the encryption and decryption process using S-DES and analyze its performance with respect to the avalanche effect.\n\n**Experiment 3: Design and Implementation of a Hill cipher on Gray Scale Image / Colour Image**\nIn this experiment, the students designed and implemented the Hill Cipher technique on gray scale and color images. They used two different images: a cover image (acting as a key image) and an informative image. The experiment involved adding the cover image and informative image to obtain a resultant image, which was then encrypted using the Hill Cipher algorithm. The encrypted image was then decrypted by the receiver using the inverse of the key image. The goal of the experiment was to demonstrate the implementation of the Hill Cipher technique on images and its use for secure communication."
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {uploadStatus === "error" && (
                    <div className="flex items-center gap-2 mt-4 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{errorMessage || "Upload failed"}</span>
                    </div>
                  )}
                  {resetStatus === "success" && (
                    <div className="flex items-center gap-2 mt-4 text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      <span>Vectorstore reset successfully!</span>
                    </div>
                  )}
                  {resetStatus === "error" && (
                    <div className="flex items-center gap-2 mt-4 text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{errorMessage || "Reset failed"}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="overflow-hidden border shadow-sm h-full">
                <CardHeader className="bg-muted/70 p-4">
                  <CardTitle className="text-base md:text-lg">Chat with your PDFs</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ChatInterface
                    apiStatus={apiStatus}
                    uploadStatus={uploadStatus}
                    chatHistory={chatHistory}
                    setChatHistory={setChatHistory}
                    setErrorMessage={setErrorMessage}
                    onSaveChat={saveCurrentChat}
                    currentChat={currentChat}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}