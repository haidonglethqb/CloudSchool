'use client'

import { useState, useEffect } from 'react'
import { parentApi } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface ScoreEntry {
  componentName: string
  weight: number
  value: number | null
}

interface SubjectScore {
  semester: {
    id: string
    name: string
    year?: string | null
    displayName?: string
    startDate?: string | null
    endDate?: string | null
  }
  subject: { id: string; name: string }
  scores: ScoreEntry[]
  average: number | null
  isPassing: boolean | null
}

interface StudentInfo {
  id: string
  fullName: string
  studentCode: string
  class: string
  grade: string
}

const getSemesterLabel = (semester?: {
  name?: string
  year?: string | null
  displayName?: string
  startDate?: string | null
  endDate?: string | null
}) => {
  if (!semester) return ''
  if (semester.displayName) return semester.displayName
  if (semester.year && semester.name) return `${semester.name} (${semester.year})`
  if (semester.startDate && semester.endDate && semester.name) {
    const startYear = new Date(semester.startDate).getFullYear()
    const endYear = new Date(semester.endDate).getFullYear()
    if (!Number.isNaN(startYear) && !Number.isNaN(endYear)) {
      const schoolYear = startYear === endYear ? `${startYear}` : `${startYear}-${endYear}`
      return `${semester.name} (${schoolYear})`
    }
  }
  return semester.name || ''
}

export default function ChildScoresPage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [subjects, setSubjects] = useState<SubjectScore[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    parentApi.getSemesters(studentId as string)
      .then(res => {
        setSemesters(res.data?.data || [])
        const active = res.data?.data?.find((s: any) => s.isActive)
        if (active) setSelectedSemester(active.id)
      })
      .catch(() => {})
  }, [studentId])

  useEffect(() => {
    if (!studentId) return
    setLoading(true)
    parentApi.getChildScores(studentId as string, selectedSemester || undefined)
      .then(res => {
        setStudent(res.data?.data?.student || null)
        // Normalize: backend may return old format or new ScoreComponent format
        const raw = res.data?.data?.scores || []
        const normalized: SubjectScore[] = raw.map((item: any) => {
          // If scores are already in new format (array of {componentName, weight, value})
          if (item.scores && Array.isArray(item.scores) && item.scores[0]?.componentName) {
            return item
          }
          // Legacy fallback: transform quiz15/quiz45/final to generic entries
          const entries: ScoreEntry[] = []
          if (item.quiz15?.length) {
            entries.push({ componentName: 'KT 15 phút', weight: 1, value: item.quiz15Avg ?? null })
          }
          if (item.quiz45?.length) {
            entries.push({ componentName: 'KT 1 tiết', weight: 2, value: item.quiz45Avg ?? null })
          }
          if (item.final !== null && item.final !== undefined) {
            entries.push({ componentName: 'Cuối kỳ', weight: 3, value: item.final })
          }
          return { ...item, scores: entries }
        })
        setSubjects(normalized)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId, selectedSemester])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
  }

  const componentNames = Array.from(new Set(subjects.flatMap(item => item.scores.map(score => score.componentName))))
  const scoreColumnCount = Math.max(componentNames.length, 1)
  const tableMinWidth = 520 + scoreColumnCount * 112
  const subjectAverages = subjects
    .map(item => item.average)
    .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
  const overallAverage = subjectAverages.length > 0
    ? subjectAverages.reduce((sum, value) => sum + value, 0) / subjectAverages.length
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/my-children" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điểm</h1>
          {student && <p className="text-gray-500 mt-1">{student.fullName} - {student.studentCode} - Lớp {student.class}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="label">Học kỳ:</label>
        <select value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)} className="input max-w-xs">
          <option value="">Tất cả</option>
          {semesters.map((s: any) => (
            <option key={s.id} value={s.id}>
              {getSemesterLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed" style={{ minWidth: `${tableMinWidth}px` }}>
            <colgroup>
              <col className="w-[180px]" />
              <col className="w-[180px]" />
              {componentNames.length > 0 ? (
                componentNames.map(name => <col key={name} className="w-28" />)
              ) : (
                <col className="w-28" />
              )}
              <col className="w-24" />
              <col className="w-32" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100">
                <th className="table-header">Học kỳ</th>
                <th className="table-header">Môn học</th>
                {componentNames.length > 0 ? (
                  componentNames.map(name => (
                    <th key={name} className="table-header text-center whitespace-normal">{name}</th>
                  ))
                ) : (
                  <th className="table-header text-center">Điểm</th>
                )}
                <th className="table-header text-center">TB Môn</th>
                <th className="table-header text-center">Kết quả</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subjects.length === 0 ? (
                <tr>
                  <td colSpan={4 + scoreColumnCount} className="px-4 py-12 text-center text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Chưa có dữ liệu điểm</p>
                  </td>
                </tr>
              ) : (
                subjects.map((item, idx) => {
                  const scoreMap = new Map(item.scores.map(score => [score.componentName, score.value]))

                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="table-cell">{getSemesterLabel(item.semester)}</td>
                      <td className="table-cell font-medium">{item.subject.name}</td>
                      {componentNames.length > 0 ? (
                        componentNames.map(name => {
                          const value = scoreMap.get(name)

                          return (
                            <td key={name} className="table-cell text-center tabular-nums">
                              <span className="font-medium">{value !== null && value !== undefined ? value : '-'}</span>
                            </td>
                          )
                        })
                      ) : (
                        <td className="table-cell text-center text-gray-400">-</td>
                      )}
                      <td className="table-cell text-center tabular-nums">
                        {item.average !== null ? (
                          <span className={`font-bold text-lg ${item.isPassing ? 'text-green-600' : 'text-red-600'}`}>
                            {typeof item.average === 'number' ? item.average.toFixed(2) : item.average}
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="table-cell text-center">
                        {item.isPassing !== null ? (
                          item.isPassing ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              <CheckCircle className="w-3 h-3" /> Đạt
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              <XCircle className="w-3 h-3" /> Chưa đạt
                            </span>
                          )
                        ) : <span className="text-gray-400 text-xs">Chưa đủ điểm</span>}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {subjects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          <div className="card p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">TB chung</h3>
            <p className="text-2xl font-bold text-primary tabular-nums">
              {overallAverage !== null ? overallAverage.toFixed(2) : '-'}
            </p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Tổng số môn</h3>
            <p className="text-2xl font-bold text-gray-900">{subjects.length}</p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Môn đạt</h3>
            <p className="text-2xl font-bold text-green-600">{subjects.filter(s => s.isPassing === true).length}</p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Môn chưa đạt</h3>
            <p className="text-2xl font-bold text-red-600">{subjects.filter(s => s.isPassing === false).length}</p>
          </div>
        </div>
      )}
    </div>
  )
}
