'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { studentApi, scoreApi, subjectApi, classApi, scoreComponentApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  Save,
  Loader2,
  BookOpen,
  AlertCircle,
  Lock,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface Student {
  id: string
  studentCode: string
  fullName: string
  class: {
    id: string
    name: string
    grade: { id: string; name: string }
  } | null
}

interface ScoreEntry {
  id: string
  value: number
  isLocked: boolean
  studentId: string
  subjectId: string
  semesterId: string
  scoreComponentId: string
  scoreComponent: { id: string; name: string; weight: number }
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
  isActive: boolean
}

interface ScoreData {
  subjectScores: SubjectScore[]
  overallAverage: number | null
}

interface ComponentInfo {
  id: string
  name: string
  weight: number
}

interface SubjectComponentData {
  subjectId: string
  subjectName: string
  components: ComponentInfo[]
}

export default function StudentScoreEditPage() {
  const { id } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useAuthStore(s => s.user)
  const isAdminOrStaff = user?.role === 'SUPER_ADMIN' || user?.role === 'STAFF'
  const isTeacher = user?.role === 'TEACHER'

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [scoreData, setScoreData] = useState<ScoreData | null>(null)
  const [loadingScores, setLoadingScores] = useState(false)
  const [saving, setSaving] = useState(false)

  // key = "subjectId::componentId", value = new score value (null = cleared)
  const [editedValues, setEditedValues] = useState<Map<string, number | null>>(new Map())

  const [editableSubjectIds, setEditableSubjectIds] = useState<Set<string> | null>(null)

  // All score components grouped by subject (fetched once on mount)
  const [componentsBySubject, setComponentsBySubject] = useState<Map<string, SubjectComponentData>>(new Map())

  useEffect(() => {
    if (!isAdminOrStaff && !isTeacher) {
      toast.error('Bạn không có quyền truy cập trang này')
      router.push(`/students/${id}`)
      return
    }

    const fetchInitial = async () => {
      try {
        const [studentRes, semRes, compRes] = await Promise.all([
          studentApi.get(id as string),
          subjectApi.getSemesters().catch(() => ({ data: { data: [] } })),
          scoreComponentApi.list(),
        ])
        const studentData = studentRes.data.data
        setStudent(studentData)

        const sems = semRes.data.data || []
        setSemesters(sems)
        const semFromQuery = searchParams.get('semester')
        const targetSem = semFromQuery && sems.find((s: Semester) => s.id === semFromQuery)
          ? semFromQuery
          : sems.find((s: Semester) => s.isActive)?.id
        if (targetSem) setSelectedSemester(targetSem)

        // Group score components by subject
        const allComps = compRes.data.data || []
        const grouped = new Map<string, SubjectComponentData>()
        for (const comp of allComps) {
          const subId = comp.subjectId || comp.subject?.id
          if (!subId) continue
          if (!grouped.has(subId)) {
            grouped.set(subId, {
              subjectId: subId,
              subjectName: comp.subject?.name || '',
              components: [],
            })
          }
          grouped.get(subId)!.components.push({
            id: comp.id,
            name: comp.name,
            weight: comp.weight,
          })
        }
        grouped.forEach(data => {
          data.components.sort((a, b) => a.weight - b.weight)
        })
        setComponentsBySubject(grouped)

        if (isTeacher && studentData.class) {
          try {
            const classesRes = await classApi.list()
            const classes = classesRes.data.data || []
            const studentClass = classes.find((c: any) => c.id === studentData.class?.id)
            if (studentClass?.teacherAssignments) {
              const myAssignments = studentClass.teacherAssignments.filter(
                (a: any) => a.teacher?.id === user?.id
              )
              setEditableSubjectIds(new Set(myAssignments.map((a: any) => a.subject?.id)))
            } else {
              setEditableSubjectIds(new Set())
            }
          } catch {
            setEditableSubjectIds(new Set())
          }
        } else if (isAdminOrStaff) {
          setEditableSubjectIds(null)
        }
      } catch (error: any) {
        console.error('Failed to fetch student:', error)
        if (error.response?.status === 404) {
          toast.error('Không tìm thấy học sinh')
          router.push('/students')
        }
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchInitial()
  }, [id, router, isAdminOrStaff, isTeacher, user?.id])

  const fetchScores = useCallback(async () => {
    if (!id || !selectedSemester) return
    setLoadingScores(true)
    try {
      const res = await scoreApi.getByStudent(id as string, selectedSemester)
      setScoreData(res.data.data)
      setEditedValues(new Map())
    } catch {
      setScoreData(null)
    } finally {
      setLoadingScores(false)
    }
  }, [id, selectedSemester])

  useEffect(() => {
    if (student && selectedSemester) fetchScores()
  }, [student, selectedSemester, fetchScores])

  const canEditSubject = (subjectId: string) => {
    if (editableSubjectIds === null) return true
    return editableSubjectIds.has(subjectId)
  }

  const getScoreValue = (subjectId: string, componentId: string, originalValue?: number): string => {
    const key = `${subjectId}::${componentId}`
    const edited = editedValues.get(key)
    if (edited !== undefined) {
      return edited === null ? '' : edited.toString()
    }
    return originalValue !== undefined ? originalValue.toString() : ''
  }

  const handleScoreChange = (subjectId: string, componentId: string, value: string) => {
    const key = `${subjectId}::${componentId}`
    setEditedValues(prev => {
      const next = new Map(prev)
      if (value === '') {
        next.set(key, null)
      } else {
        const num = parseFloat(value)
        if (!isNaN(num) && num >= 0 && num <= 10) {
          next.set(key, num)
        }
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!student || !selectedSemester) return

    const scoresToSave: Array<{
      studentId: string
      subjectId: string
      semesterId: string
      scoreComponentId: string
      value: number
    }> = []

    const subjectScores = scoreData?.subjectScores || []

    editedValues.forEach((value, key) => {
      if (value === null) return

      const sepIdx = key.indexOf('::')
      const subjectId = key.substring(0, sepIdx)
      const componentId = key.substring(sepIdx + 2)

      const subjectData = subjectScores.find(s => s.subject.id === subjectId)
      const existingScore = subjectData?.scores.find(s => s.scoreComponentId === componentId)

      // Skip if value unchanged from existing
      if (existingScore && existingScore.value === value) return

      scoresToSave.push({
        studentId: student.id,
        subjectId,
        semesterId: selectedSemester,
        scoreComponentId: componentId,
        value,
      })
    })

    if (scoresToSave.length === 0) {
      toast.error('Không có thay đổi để lưu')
      return
    }

    try {
      setSaving(true)
      await scoreApi.batchSave(scoresToSave)
      toast.success(`Đã lưu ${scoresToSave.length} điểm thành công`)
      setEditedValues(new Map())
      fetchScores()
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Lưu điểm thất bại')
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

  if (!student) return null

  const subjectScores = scoreData?.subjectScores || []

  // Build unified column names from ALL score components (by name, not ID)
  const columnWeights = new Map<string, number[]>()
  componentsBySubject.forEach(data => {
    data.components.forEach(c => {
      if (!columnWeights.has(c.name)) columnWeights.set(c.name, [])
      columnWeights.get(c.name)!.push(c.weight)
    })
  })

  const columnNames = Array.from(columnWeights.entries())
    .sort((a, b) => {
      const avgA = a[1].reduce((s, v) => s + v, 0) / a[1].length
      const avgB = b[1].reduce((s, v) => s + v, 0) / b[1].length
      return avgA - avgB
    })
    .map(([name]) => name)

  // Merge component config with actual score data
  const displaySubjects = Array.from(componentsBySubject.values())
    .map(({ subjectId, subjectName, components }) => {
      const existingData = subjectScores.find(s => s.subject.id === subjectId)
      return {
        subject: { id: subjectId, name: subjectName },
        scores: existingData?.scores || [],
        average: existingData?.average ?? null,
        isPassed: existingData?.isPassed ?? false,
        components,
      }
    })
    .sort((a, b) => a.subject.name.localeCompare(b.subject.name, 'vi'))

  const actualChangeCount = Array.from(editedValues.values()).filter(v => v !== null).length
  const hasChanges = actualChangeCount > 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Link
            href={`/students/${id}`}
            className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sửa điểm học sinh</h1>
            <p className="text-gray-500 text-sm mt-1">
              {student.fullName} - {student.studentCode}
              {student.class && ` - Lớp ${student.class.name}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="input py-1.5 text-sm w-48"
            value={selectedSemester}
            onChange={e => setSelectedSemester(e.target.value)}
          >
            <option value="">-- Chọn học kỳ --</option>
            {semesters.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}{s.isActive ? ' (Hiện tại)' : ''}
              </option>
            ))}
          </select>
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="btn-primary whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Lưu điểm {hasChanges ? `(${actualChangeCount})` : ''}
          </button>
        </div>
      </div>

      {/* Teacher notices */}
      {isTeacher && editableSubjectIds !== null && editableSubjectIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Bạn chỉ có thể sửa điểm các môn được phân công giảng dạy.</span>
        </div>
      )}

      {isTeacher && editableSubjectIds !== null && editableSubjectIds.size === 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-yellow-50 text-yellow-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Bạn chưa được phân công môn nào cho lớp này. Liên hệ quản trị viên.</span>
        </div>
      )}

      {/* Score Table */}
      {!selectedSemester ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Vui lòng chọn học kỳ để sửa điểm</p>
        </div>
      ) : loadingScores ? (
        <div className="card p-12 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : displaySubjects.length === 0 ? (
        <div className="card p-12 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Chưa có cấu hình điểm cho môn học nào</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="table-header whitespace-nowrap">Môn học</th>
                  {columnNames.map(name => (
                    <th key={name} className="table-header text-center whitespace-nowrap">
                      {name}
                    </th>
                  ))}
                  <th className="table-header text-center whitespace-nowrap">TB môn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displaySubjects.map(item => {
                  const subjectEditable = canEditSubject(item.subject.id)

                  // Map componentName -> { componentId, existingScore }
                  const compByName = new Map<string, { componentId: string; score: ScoreEntry | null; isLocked: boolean }>()
                  for (const comp of item.components) {
                    const existingScore = item.scores.find(s => s.scoreComponentId === comp.id) || null
                    compByName.set(comp.name, {
                      componentId: comp.id,
                      score: existingScore,
                      isLocked: existingScore?.isLocked || false,
                    })
                  }

                  return (
                    <tr key={item.subject.id} className={subjectEditable ? 'hover:bg-gray-50' : 'bg-gray-50/50'}>
                      <td className="table-cell font-medium text-gray-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {item.subject.name}
                          {!subjectEditable && (
                            <span className="text-xs text-gray-400 font-normal">(chỉ xem)</span>
                          )}
                        </div>
                      </td>
                      {columnNames.map(colName => {
                        const info = compByName.get(colName)

                        if (!info) {
                          return (
                            <td key={colName} className="px-2 py-2 text-center">
                              <span className="text-gray-300">-</span>
                            </td>
                          )
                        }

                        const { componentId, score, isLocked: locked } = info
                        const isLockedForTeacher = locked && isTeacher
                        const editable = subjectEditable && !isLockedForTeacher

                        return (
                          <td key={colName} className="px-2 py-2">
                            <div className="flex items-center justify-center gap-1">
                              {editable ? (
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  step="0.1"
                                  className="w-16 px-2 py-1 text-sm text-center border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                  value={getScoreValue(item.subject.id, componentId, score?.value)}
                                  onChange={e => handleScoreChange(item.subject.id, componentId, e.target.value)}
                                  placeholder="-"
                                />
                              ) : (
                                <div className="flex items-center gap-1">
                                  {score ? (
                                    <span className={`text-sm font-medium ${score.value >= 5 ? 'text-gray-700' : 'text-red-600'}`}>
                                      {score.value.toFixed(1)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                  {isLockedForTeacher && <Lock className="w-3 h-3 text-yellow-500" />}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                      <td className="table-cell text-center">
                        {item.average !== null ? (
                          <span className={`font-bold ${item.isPassed ? 'text-green-600' : 'text-red-600'}`}>
                            {item.average.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex flex-wrap gap-4">
            <span>Điểm: 0 - 10</span>
            {isTeacher && (
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-yellow-500" /> Điểm đã khóa (chỉ Admin/Staff sửa được)
              </span>
            )}
            <span>(chỉ xem) = Môn không được phân công</span>
          </div>
        </div>
      )}
    </div>
  )
}
