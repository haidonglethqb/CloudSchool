# Indexes & Performance

Key Prisma constraints and indexes relevant to scope-heavy queries.

## Unique Constraints

| Model | Fields |
|---|---|
| `User` | `(tenantId, email)` |
| `Class` | `(tenantId, name, academicYear)` |
| `Semester` | `(tenantId, year, semesterNum)` |
| `AcademicYear` | `(tenantId, startYear, endYear)` |
| `TeacherAssignment` | `(teacherId, classId, subjectId, semesterId)` |
| `Score` | `(studentId, subjectId, semesterId, scoreComponentId)` |
| `ClassEnrollment` | `(studentId, semesterId)` |

## Important Indexes

| Model | Index | Query Pattern |
|---|---|---|
| `TeacherAssignment` | `(tenantId, teacherId, semesterId)` | teacher/staff scope in one semester |
| `TeacherAssignment` | `(classId, tenantId)` | assignments for class detail |
| `TeacherAssignment` | `(semesterId, tenantId)` | semester-based filtering |
| `Semester` | `(tenantId, isActive)` | active semester lookup |
| `ClassEnrollment` | `(tenantId, classId, semesterId)` | roster by semester |
| `Score` | `(tenantId, subjectId, semesterId)` | class subject reports |
| `Score` | `(tenantId, studentId)` | student score history |

## Why Semester In Assignment Matters

Without `semesterId` inside `TeacherAssignment`, these queries are ambiguous:

1. teacher teaches class A in HK1 but not HK2
2. same teacher changes between academic years
3. score entry dropdowns need exact subject list for one class and one semester

Adding `semesterId` removes that ambiguity and keeps scope checks index-friendly.

## Related

- [Schema Overview](./schema-overview.md)
- [User Models](./user-models.md)
- [Score Entry Flow](../data-flows/score-entry-flow.md)
