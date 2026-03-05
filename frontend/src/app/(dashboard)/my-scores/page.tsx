'use client'

import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/auth'
import { scoreApi, subjectApi } from '@/lib/api'
import toast from 'react-hot-toast'
import { Loader2, BookOpen, TrendingUp, Award } from 'lucide-react'

interface ScoreComponent {
  id: string
  name: string
  weight: number
}

interface ScoreEntry {
  id: string
  value: number
  subject: { id: string; name: string }
  semester: { id: string; name: string; year: string }
  scoreComponent: ScoreComponent
}

interface SubjectScore {
  subject: { id: string; name: string }
  scores: ScoreEntry[]
  average: number | null
  isPassed: boolean
}

interface Semester {
  id: string
  name: string
  year: string
  isActive: boolean
}

export default function MyScoresPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [data, setData] = useState<{
    subjectScores: SubjectScore[]
    overallAverage: number | null
    ranking: number | null
    totalStudents: number | null
  } | null>(null)

  // Load semesters
  useEffect(() => {
    subjectApi.getSemesters()
      .then(res => {
        const sems = res.data.data || []
        setSemesters(sems)
        const active = sems.find((s: Semester) => s.isActive)
        if (active) setSelectedSemester(active.id)
        else if (sems.length > 0) setSelectedSemester(sems[0].id)
      })
      .catch(() => toast.error('Lỗi tải học kỳ'))
  }, [])

  // Load scores when semester changes
  const fetchScores = useCallback(async () => {
    if (!user?.id || !selectedSemester) return
    setLoading(true)
    try {
      // Get student profile to get studentId
      const studentProfile = user as any
      // Use score API to get student scores - we need the studentId linked to this user
      const res = await scoreApi.getByStudent(studentProfile.id, selectedSemester)
      setData(res.data.data)
    } catch {
      // If the student hasn't been linked to scores yet, show empty
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user, selectedSemester])

  useEffect(() => { fetchScores() }, [fetchScores])

  const getGradeLabel = (avg: number | null) => {
    if (avg === null) return { label: '-', cls: 'text-gray-400' }
    if (avg >= 8.5) return { label: 'Giỏi', cls: 'text-green-600' }
    if (avg >= 6.5) return { label: 'Khá', cls: 'text-blue-600' }
    if (avg >= 5.0) return { label: 'TB', cls: 'text-yellow-600' }
    return { label: 'Yếu', cls: 'text-red-600' }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Xem điểm của tôi</h1>
          <p className="text-gray-600 mt-1">Bảng điểm chi tiết theo học kỳ</p>
        </div>
        <select
          className="input w-60"
          value={selectedSemester}
          onChange={e => setSelectedSemester(e.target.value)}
        >
          <option value="">-- Chọn học kỳ --</option>
          {semesters.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.year})</option>
          ))}
        </select>
      </div>

      {!selectedSemester ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Vui lòng chọn học kỳ để xem điểm</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !data || !data.subjectScores || data.subjectScores.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Chưa có điểm trong học kỳ này</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Điểm TB chung</p>
                  <p className="text-xl font-bold text-gray-900">
                    {data.overallAverage !== null ? data.overallAverage.toFixed(2) : '-'}
                  </p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <Award className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Xếp loại</p>
                  <p className={`text-xl font-bold ${getGradeLabel(data.overallAverage).cls}`}>
                    {getGradeLabel(data.overallAverage).label}
                  </p>
                </div>
              </div>
            </div>
            {data.ranking && (
              <div className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Award className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Xếp hạng trong lớp</p>
                    <p className="text-xl font-bold text-gray-900">
                      {data.ranking}/{data.totalStudents}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Score table */}
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header">Môn học</th>
                  <th className="table-header">Điểm thành phần</th>
                  <th className="table-header text-center">TB môn</th>
                  <th className="table-header text-center">Kết quả</th>
                </tr>
              </thead>
              <tbody>
                {data.subjectScores.map(item => (
                  <tr key={item.subject.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="table-cell font-medium text-gray-900">{item.subject.name}</td>
                    <td className="table-cell">
                      <div className="flex flex-wrap gap-2">
                        {item.scores.map(s => (
                          <span key={s.id} className="inline-flex items-center gap-1 text-sm">
                            <span className="text-gray-500">{s.scoreComponent.name}:</span>
                            <span className="font-medium">{s.value}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="table-cell text-center">
                      <span className={`font-bold ${item.average !== null && item.average >= 5 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.average !== null ? item.average.toFixed(2) : '-'}
                      </span>
                    </td>
                    <td className="table-cell text-center">
                      {item.isPassed ? (
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Đạt</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Chưa đạt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
