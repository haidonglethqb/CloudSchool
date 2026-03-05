'use client'

import { useEffect, useState } from 'react'
import { reportApi, subjectApi } from '@/lib/api'
import { getPassStatus } from '@/lib/utils'
import {
  BarChart3,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Subject {
  id: string
  name: string
}

interface Semester {
  id: string
  name: string
  isActive: boolean
}

interface ClassStat {
  class: {
    id: string
    name: string
    grade: { name: string; level: number }
  }
  totalStudents: number
  passedStudents: number
  passRate: number
  averageScore: number
}

interface ReportData {
  subject?: { id: string; name: string }
  semester?: { id: string; name: string }
  passScore: number
  classes: ClassStat[]
  summary: {
    totalStudents: number
    totalPassed: number
    passRate: number
    averageScore: number
  }
}

type ReportType = 'subject' | 'semester'

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('subject')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [subjectsRes, semestersRes] = await Promise.all([
          subjectApi.list(),
          subjectApi.getSemesters(),
        ])
        setSubjects(subjectsRes.data.data)
        setSemesters(semestersRes.data.data)

        // Auto-select active semester
        const activeSemester = semestersRes.data.data.find(
          (s: Semester) => s.isActive
        )
        if (activeSemester) {
          setSelectedSemester(activeSemester.id)
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const fetchReport = async () => {
    if (!selectedSemester) {
      toast.error('Vui lòng chọn học kỳ')
      return
    }

    if (reportType === 'subject' && !selectedSubject) {
      toast.error('Vui lòng chọn môn học')
      return
    }

    try {
      setLoadingReport(true)
      let response

      if (reportType === 'subject') {
        response = await reportApi.subjectSummary(selectedSubject, selectedSemester)
      } else {
        response = await reportApi.semesterSummary(selectedSemester)
      }

      setReportData(response.data.data)
    } catch (error: any) {
      console.error('Failed to fetch report:', error)
      toast.error('Không thể tải báo cáo')
    } finally {
      setLoadingReport(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Báo cáo tổng kết</h1>
        <p className="text-gray-600 text-sm mt-1">
          BM5 - Lập báo cáo tổng kết môn học và học kỳ
        </p>
      </div>

      {/* Report Type Selection */}
      <div className="card">
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => {
              setReportType('subject')
              setReportData(null)
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              reportType === 'subject'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            BM5.1 - Tổng kết môn học
          </button>
          <button
            onClick={() => {
              setReportType('semester')
              setReportData(null)
            }}
            className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              reportType === 'semester'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4 inline-block mr-2" />
            BM5.2 - Tổng kết học kỳ
          </button>
        </div>

        {/* Filters */}
        <div className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            {reportType === 'subject' && (
              <div className="min-w-[200px]">
                <label className="label">Môn học</label>
                <select
                  className="input"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                >
                  <option value="">Chọn môn học</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="min-w-[200px]">
              <label className="label">Học kỳ</label>
              <select
                className="input"
                value={selectedSemester}
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                <option value="">Chọn học kỳ</option>
                {semesters.map((semester) => (
                  <option key={semester.id} value={semester.id}>
                    {semester.name} {semester.isActive && '(Hiện tại)'}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={fetchReport}
              disabled={loadingReport}
              className="btn-primary"
            >
              {loadingReport ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <BarChart3 className="w-4 h-4 mr-2" />
              )}
              Xem báo cáo
            </button>
          </div>
        </div>
      </div>

      {/* Report Display */}
      {loadingReport ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* Report Header */}
          <div className="card p-4 bg-gradient-to-r from-primary to-primary-600 text-white">
            <h2 className="text-lg font-semibold">
              {reportType === 'subject'
                ? `Báo cáo tổng kết môn ${reportData.subject?.name}`
                : `Báo cáo tổng kết học kỳ`}
            </h2>
            <p className="text-white/80 text-sm mt-1">
              {reportData.semester?.name} | Điểm đạt ≥ {reportData.passScore}
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {reportData.summary.totalStudents}
              </p>
              <p className="text-sm text-gray-500">Tổng học sinh</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {reportData.summary.totalPassed}
              </p>
              <p className="text-sm text-gray-500">Học sinh đạt</p>
            </div>
            <div className="card p-4 text-center">
              <div className="flex items-center justify-center gap-1">
                <p className="text-2xl font-bold text-primary">
                  {reportData.summary.passRate}%
                </p>
                {reportData.summary.passRate >= 50 ? (
                  <TrendingUp className="w-5 h-5 text-green-500" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-sm text-gray-500">Tỷ lệ đạt</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-orange-600">
                {reportData.summary.averageScore}
              </p>
              <p className="text-sm text-gray-500">Điểm TB chung</p>
            </div>
          </div>

          {/* Class Details Table */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Chi tiết theo lớp</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="table-header">STT</th>
                    <th className="table-header">Lớp</th>
                    <th className="table-header text-center">Sĩ số</th>
                    <th className="table-header text-center">Số đạt</th>
                    <th className="table-header text-center">Tỷ lệ</th>
                    <th className="table-header text-center">Điểm TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reportData.classes.map((cls, idx) => (
                    <tr key={cls.class.id} className="hover:bg-gray-50">
                      <td className="table-cell text-center">{idx + 1}</td>
                      <td className="table-cell">
                        <span className="font-medium">{cls.class.name}</span>
                        <span className="text-gray-400 text-xs ml-2">
                          ({cls.class.grade.name})
                        </span>
                      </td>
                      <td className="table-cell text-center">{cls.totalStudents}</td>
                      <td className="table-cell text-center text-green-600 font-medium">
                        {cls.passedStudents}
                      </td>
                      <td className="table-cell text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                cls.passRate >= 80
                                  ? 'bg-green-500'
                                  : cls.passRate >= 50
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                              }`}
                              style={{ width: `${cls.passRate}%` }}
                            />
                          </div>
                          <span
                            className={`text-sm font-medium ${
                              cls.passRate >= 80
                                ? 'text-green-600'
                                : cls.passRate >= 50
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            }`}
                          >
                            {cls.passRate}%
                          </span>
                        </div>
                      </td>
                      <td className="table-cell text-center font-semibold">
                        {cls.averageScore > 0 ? cls.averageScore.toFixed(2) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Chọn các tiêu chí và nhấn "Xem báo cáo"</p>
        </div>
      )}
    </div>
  )
}
