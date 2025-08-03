import React from 'react'
import { FileText } from 'lucide-react'
import ResumeBuilder from '@/components/resume/ResumeBuilder'

export default function ResumePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <FileText className="h-8 w-8" />
          Resume Builder
        </h1>
        <p className="text-muted-foreground mt-2">
          Create ATS-optimized resumes tailored for your target roles
        </p>
      </div>
      
      <ResumeBuilder />
    </div>
  )
}