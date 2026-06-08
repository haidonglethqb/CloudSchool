# Database Schema Overview

PostgreSQL schema managed by Prisma.

## Main Academic Models

| Model | Purpose |
|---|---|
| `AcademicYear` | school year window |
| `Semester` | term inside one academic year |
| `Grade` | grade level |
| `Class` | class record for one academic year |
| `ClassEnrollment` | student-class-semester placement |
| `Subject` | subject catalog |
| `SubjectVersion` | subject scope by academic year |
| `TeacherAssignment` | teacher/staff scope by class+subject+semester |
| `ScoreComponentSet` | scoring setup by subject+semester |
| `Score` | student score row |
| `Promotion` | semester result |

## Scope Boundaries

1. `Class` is year-aware. Same label like `10A1` can exist in many years.
2. `Semester` belongs to one `AcademicYear`.
3. `TeacherAssignment` belongs to one `Semester`.
4. `Score` belongs to one `Semester`.
5. `ClassEnrollment` resolves the student's class for a semester.

## Assignment Boundary

Teaching permission is not inferred from class name or active year alone.

```text
TeacherAssignment = teacherId + classId + subjectId + semesterId
```

That rule is used by:

1. class list and class detail scoping
2. subject dropdown filtering
3. score entry and score history
4. teacher/staff scoped reports

## Related

- [Academic Structure](./academic-structure.md)
- [User Models](./user-models.md)
- [Scoring Models](./scoring-models.md)
