'use client'

import { useState, useEffect } from 'react'
import { parentApi } from '@/lib/api'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BookOpen, CheckCircle, XCircle } from 'lucide-react'

interface ScoreData {
  semester: { id: string; name: string; year: string }
  subject: { id: string; name: string }
  quiz15: number[]
  quiz45: number[]
  final: number | null
  quiz15Avg: number | null
  quiz45Avg: number | null
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

export default function ChildScoresPage() {
  const { studentId } = useParams()
  const [student, setStudent] = useState<StudentInfo | null>(null)
  const [scores, setScores] = useState<ScoreData[]>([])
  const [semesters, setSemesters] = useState<any[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        const res = await parentApi.getSemesters()
        if (res.data?.data) {
          setSemesters(res.data.data)
          const activeSemester = res.data.data.find((s: any) => s.isActive)
          if (activeSemester) {
            setSelectedSemester(activeSemester.id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch semesters:', err)
      }
    }
    fetchSemesters()
  }, [])

  useEffect(() => {
    const fetchScores = async () => {
      setLoading(true)
      try {
        const res = await parentApi.getChildScores(
          studentId as string,
          selectedSemester || undefined
        )
        if (res.data?.data) {
          setStudent(res.data.data.student)
          setScores(res.data.data.scores)
        }
      } catch (err) {
        console.error('Failed to fetch scores:', err)
      } finally {
        setLoading(false)
      }
    }

    if (studentId) {
      fetchScores()
    }
  }, [studentId, selectedSemester])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link
          href="/my-children"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bảng điểm</h1>
          {student && (
            <p className="text-gray-500 mt-1">
              {student.fullName} - {student.studentCode} - Lớp {student.class}
            </p>
          )}
        </div>
      </div>

      {/* Semester filter */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Học kỳ:</label>
        <select
          value={selectedSemester}
          onChange={(e) => setSelectedSemester(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
        >
          <option value="">Tất cả học kỳ</option>
          {semesters.map((sem) => (
            <option key={sem.id} value={sem.id}>
              {sem.name} ({sem.year})
            </option>
          ))}
        </select>
      </div>

      {/* Scores table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Học kỳ
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Môn học
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm 15'
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm 1 tiết
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Điểm thi
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TB Môn
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kết quả
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {scores.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Chưa có dữ liệu điểm</p>
                  </td>
                </tr>
              ) : (
                scores.map((score, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {score.semester.name}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {score.subject.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm">
                        {score.quiz15.length > 0 ? (
                          <>
                            <span className="text-gray-500">
                              {score.quiz15.join(', ')}
                            </span>
                            <div className="text-xs text-primary font-medium">
                              TB: {score.quiz15Avg}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm">
                        {score.quiz45.length > 0 ? (
                          <>
                            <span className="text-gray-500">
                              {score.quiz45.join(', ')}
                            </span>
                            <div className="text-xs text-primary font-medium">
                              TB: {score.quiz45Avg}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium">
                      {score.final !== null ? score.final : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.average !== null ? (
                        <span className={`font-bold text-lg ${
                          score.isPassing ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {score.average}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {score.isPassing !== null ? (
                        score.isPassing ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            Chưa đạt
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 text-xs">Chưa đủ điểm</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {scores.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Tổng số môn</h3>
            <p className="text-2xl font-bold text-gray-900">{scores.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Môn đạt</h3>
            <p className="text-2xl font-bold text-green-600">
              {scores.filter(s => s.isPassing === true).length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Môn chưa đạt</h3>
            <p className="text-2xl font-bold text-red-600">
              {scores.filter(s => s.isPassing === false).length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
