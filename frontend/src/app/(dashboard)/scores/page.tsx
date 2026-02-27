'use client'

import { useEffect, useState, useCallback } from 'react'
import { classApi, subjectApi, scoreApi, settingsApi } from '@/lib/api'
import { getPassStatus } from '@/lib/utils'
import { Save, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Class {
  id: string
  name: string
  grade: { name: string }
}

interface Subject {
  id: string
  name: string
  code: string
}

interface Semester {
  id: string
  name: string
  isActive: boolean
}

interface StudentScore {
  studentId: string
  studentCode: string
  fullName: string
  scores: {
    quiz15: number[]
    quiz45: number[]
    final: number[]
  }
  average: number | null
  passed: boolean | null
}

interface Settings {
  passScore: number
  quiz15Weight: number
  quiz45Weight: number
  finalWeight: number
}

export default function ScoresPage() {
  const [classes, setClasses] = useState<Class[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [scoreData, setScoreData] = useState<StudentScore[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingScores, setLoadingScores] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editedScores, setEditedScores] = useState<
    Map<string, { studentId: string; scoreType: string; value: number }>
  >(new Map())

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [classesRes, subjectsRes, semestersRes, settingsRes] = await Promise.all(
          [classApi.list(), subjectApi.list(), subjectApi.getSemesters(), settingsApi.get()]
        )
        setClasses(classesRes.data.data)
        setSubjects(subjectsRes.data.data)
        setSemesters(semestersRes.data.data)
        setSettings(settingsRes.data.data)

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
    fetchInitialData()
  }, [])

  const fetchScores = useCallback(async () => {
    if (!selectedClass || !selectedSubject || !selectedSemester) {
      setScoreData([])
      return
    }

    try {
      setLoadingScores(true)
      const response = await scoreApi.getByClass(
        selectedClass,
        selectedSubject,
        selectedSemester
      )
      setScoreData(response.data.data)
      setEditedScores(new Map())
    } catch (error) {
      console.error('Failed to fetch scores:', error)
      toast.error('Không thể tải điểm')
    } finally {
      setLoadingScores(false)
    }
  }, [selectedClass, selectedSubject, selectedSemester])

  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  const handleScoreChange = (
    studentId: string,
    scoreType: 'quiz15' | 'quiz45' | 'final',
    index: number,
    value: string
  ) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0 || numValue > 10) return

    // Update local state
    setScoreData((prev) =>
      prev.map((student) => {
        if (student.studentId !== studentId) return student
        const newScores = { ...student.scores }
        newScores[scoreType][index] = numValue
        return { ...student, scores: newScores }
      })
    )

    // Track edited score
    const key = `${studentId}-${scoreType}-${index}`
    setEditedScores((prev) => {
      const newMap = new Map(prev)
      newMap.set(key, {
        studentId,
        scoreType: scoreType === 'quiz15' ? 'QUIZ_15' : scoreType === 'quiz45' ? 'QUIZ_45' : 'FINAL',
        value: numValue,
      })
      return newMap
    })
  }

  const handleSave = async () => {
    if (editedScores.size === 0) {
      toast.error('Không có thay đổi để lưu')
      return
    }

    try {
      setSaving(true)
      const scores = Array.from(editedScores.values()).map((score) => ({
        ...score,
        subjectId: selectedSubject,
        semesterId: selectedSemester,
      }))

      await scoreApi.batchUpdate(scores)
      toast.success('Lưu điểm thành công')
      setEditedScores(new Map())
      fetchScores()
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Lưu điểm thất bại'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const hasChanges = editedScores.size > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhập điểm môn học</h1>
          <p className="text-gray-600 text-sm mt-1">
            BM4 - Nhập và quản lý điểm theo môn học
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="btn-primary"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Lưu điểm ({editedScores.size})
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label">Lớp</label>
            <select
              className="input"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Chọn lớp</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.grade.name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Môn học</label>
            <select
              className="input"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">Chọn môn</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div>
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
        </div>
      </div>

      {/* Score Table */}
      {!selectedClass || !selectedSubject || !selectedSemester ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            Vui lòng chọn lớp, môn học và học kỳ để nhập điểm
          </p>
        </div>
      ) : loadingScores ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        </div>
      ) : scoreData.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Lớp này không có học sinh</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header" rowSpan={2}>
                    STT
                  </th>
                  <th className="table-header" rowSpan={2}>
                    Mã HS
                  </th>
                  <th className="table-header" rowSpan={2}>
                    Họ và tên
                  </th>
                  <th className="table-header text-center" colSpan={5}>
                    15 phút (x{settings?.quiz15Weight})
                  </th>
                  <th className="table-header text-center" colSpan={3}>
                    1 tiết (x{settings?.quiz45Weight})
                  </th>
                  <th className="table-header text-center">
                    Cuối kỳ (x{settings?.finalWeight})
                  </th>
                  <th className="table-header text-center" rowSpan={2}>
                    TB
                  </th>
                  <th className="table-header text-center" rowSpan={2}>
                    Kết quả
                  </th>
                </tr>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <th key={`q15-${i}`} className="px-2 py-1 text-xs text-gray-500">
                      {i}
                    </th>
                  ))}
                  {[1, 2, 3].map((i) => (
                    <th key={`q45-${i}`} className="px-2 py-1 text-xs text-gray-500">
                      {i}
                    </th>
                  ))}
                  <th className="px-2 py-1 text-xs text-gray-500">1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {scoreData.map((student, idx) => {
                  const result =
                    student.average !== null && settings
                      ? getPassStatus(student.average, settings.passScore)
                      : null

                  return (
                    <tr key={student.studentId} className="hover:bg-gray-50">
                      <td className="table-cell text-center">{idx + 1}</td>
                      <td className="table-cell font-mono text-xs">
                        {student.studentCode}
                      </td>
                      <td className="table-cell font-medium">{student.fullName}</td>

                      {/* 15 minute quizzes */}
                      {Array.from({ length: 5 }).map((_, i) => (
                        <td key={`q15-${i}`} className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            className="w-12 px-1 py-1 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            value={student.scores.quiz15[i] ?? ''}
                            onChange={(e) =>
                              handleScoreChange(
                                student.studentId,
                                'quiz15',
                                i,
                                e.target.value
                              )
                            }
                          />
                        </td>
                      ))}

                      {/* 45 minute quizzes */}
                      {Array.from({ length: 3 }).map((_, i) => (
                        <td key={`q45-${i}`} className="px-1 py-1">
                          <input
                            type="number"
                            min="0"
                            max="10"
                            step="0.1"
                            className="w-12 px-1 py-1 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            value={student.scores.quiz45[i] ?? ''}
                            onChange={(e) =>
                              handleScoreChange(
                                student.studentId,
                                'quiz45',
                                i,
                                e.target.value
                              )
                            }
                          />
                        </td>
                      ))}

                      {/* Final exam */}
                      <td className="px-1 py-1">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.1"
                          className="w-12 px-1 py-1 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                          value={student.scores.final[0] ?? ''}
                          onChange={(e) =>
                            handleScoreChange(
                              student.studentId,
                              'final',
                              0,
                              e.target.value
                            )
                          }
                        />
                      </td>

                      {/* Average */}
                      <td className="table-cell text-center font-semibold">
                        {student.average !== null
                          ? student.average.toFixed(2)
                          : '-'}
                      </td>

                      {/* Pass/Fail */}
                      <td className="table-cell text-center">
                        {result && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${result.color}`}
                          >
                            {result.passed ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <AlertCircle className="w-3 h-3" />
                            )}
                            {result.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-600">
            <p>
              <span className="font-medium">QD4:</span> Điểm từ 0 đến 10 |{' '}
              <span className="font-medium">QD5:</span> Điểm đạt ≥{' '}
              {settings?.passScore} |{' '}
              <span className="font-medium">Công thức:</span> TB = (15p ×{' '}
              {settings?.quiz15Weight} + 1t × {settings?.quiz45Weight} + CK ×{' '}
              {settings?.finalWeight}) / Tổng hệ số
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
