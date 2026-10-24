"use client";

import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";

import {
  Loader2,
  BookOpen,
  Plus,
  Search,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  IndianRupee,
  TrendingUp,
  Users,
  Tag,
  Clock,
} from "lucide-react";

import { DashboardShell } from "@/components/dashboard-shell";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import { Textarea } from "@/components/ui/textarea";

import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useAuth } from "@/lib/auth-context";

import { supabase } from "@/lib/supabase/client";

import { toast } from "sonner";
import CourseTeacherRevenueEditor from "@/components/admin/CourseTeacherRevenueEditor";

const statusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",

  pending_review: "bg-amber-100 text-amber-700",

  approved: "bg-emerald-100 text-emerald-700",

  rejected: "bg-red-100 text-red-700",

  published: "bg-sky-100 text-sky-700",

  unpublished: "bg-slate-200 text-slate-700",
};

export default function AdminCoursesPage() {
  const { user, profile, loading } = useAuth();

  const router = useRouter();

  const [courses, setCourses] = useState<any[]>([]);

  const [teachers, setTeachers] = useState<any[]>([]);

  const [earnings, setEarnings] = useState<
    Record<string, { total: number; count: number }>
  >({});

  const [search, setSearch] = useState("");

  const [dataLoading, setDataLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [courseImage, setCourseImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [imageRemoved, setImageRemoved] = useState(false);

  const [editCourse, setEditCourse] = useState<any | null>(null);
  const [revenueCourse, setRevenueCourse] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "General",
    teacher_id: "",
    suggested_price: "0",
    teacher_revenue_model: "lecture" as "lecture" | "hour",
    teacher_pool_percent: "50",
  });

  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const [reviewCourse, setReviewCourse] = useState<any | null>(null);

  const [reviewForm, setReviewForm] = useState({
    final_price: "0",
    rejection_reason: "",
  });

  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);

  const [discountCourse, setDiscountCourse] = useState<any | null>(null);

  const [discountForm, setDiscountForm] = useState({
    discount_price: "0",
    discount_active: false,
    discount_expires_at: "",
  });

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  useEffect(() => {
    if (!loading && (!user || profile?.role !== "admin")) {
      router.push("/login");
    }
  }, [loading, user, profile, router]);

  const fetchCourses = async () => {
    const { data } = await supabase

      .from("courses")

      .select("*, profiles!courses_teacher_id_fkey(full_name)")

      .order("created_at", { ascending: false });

    setCourses(data || []);

    const earningsMap: Record<string, { total: number; count: number }> = {};

    for (const c of data || []) {
      const { data: earnData } = await supabase

        .from("teacher_earnings")

        .select("teacher_earnings")

        .eq("course_id", c.id);

      const total = (earnData || []).reduce(
        (sum, e) => sum + Number(e.teacher_earnings),
        0,
      );

      earningsMap[c.id] = { total, count: earnData?.length || 0 };
    }

    setEarnings(earningsMap);

    setDataLoading(false);
  };

  useEffect(() => {
    if (profile?.role === "admin") {
      fetchCourses();

      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")

        .then(({ data }) => setTeachers(data || []));
    }
  }, [profile]);

  const resetCourseForm = () => {
    setEditCourse(null);
    setFormData({
      title: "",
      description: "",
      category: "General",
      teacher_id: "",
      suggested_price: "0",
      teacher_revenue_model: "lecture",
      teacher_pool_percent: "50",
    });
    setCourseImage(null);
    setImagePreview(null);
    setImageRemoved(false);
    const input = document.getElementById(
      "course-image",
    ) as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const openCreateCourse = () => {
    resetCourseForm();
    setDialogOpen(true);
  };

  const openEditCourse = (course: any) => {
    setEditCourse(course);
    setFormData({
      title: course.title ?? "",
      description: course.description ?? "",
      category: course.category ?? "General",
      teacher_id: course.teacher_id ?? "",
      suggested_price: String(course.suggested_price ?? 0),
      teacher_revenue_model:
        course.teacher_revenue_model === "hour" ? "hour" : "lecture",
      teacher_pool_percent: String(course.teacher_pool_percent ?? 50),
    });
    setCourseImage(null);
    setImagePreview(course.image_url ?? null);
    setImageRemoved(false);
    setDialogOpen(true);
  };

  const handleSaveCourse = async () => {
    if (!formData.title.trim() || !formData.teacher_id) {
      toast.error("Course title and teacher are required.");
      return;
    }
    if (!user?.id) {
      toast.error("Please log in again.");
      return;
    }

    const teacherPoolPercent = Number(formData.teacher_pool_percent);
    if (
      !Number.isFinite(teacherPoolPercent) ||
      teacherPoolPercent < 0 ||
      teacherPoolPercent > 100
    ) {
      toast.error("Teacher pool must be between 0 and 100 percent.");
      return;
    }

    const suggestedPrice = Number(formData.suggested_price);
    if (!Number.isFinite(suggestedPrice) || suggestedPrice < 0) {
      toast.error("Suggested price must be a valid non-negative amount.");
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/avif",
    ];
    if (courseImage && !allowedTypes.includes(courseImage.type)) {
      toast.error("Use a JPG, PNG, WebP, or AVIF image.");
      return;
    }
    if (courseImage && courseImage.size > 5 * 1024 * 1024) {
      toast.error("Course image must be 5 MB or smaller.");
      return;
    }

    setSavingCourse(true);
    let uploadedPath: string | null = null;

    try {
      let imageUrl: string | null = imageRemoved
        ? null
        : editCourse?.image_url ?? null;

      if (courseImage) {
        const extensionMap: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
          "image/avif": "avif",
        };
        const extension = extensionMap[courseImage.type];
        uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("course-images")
          .upload(uploadedPath, courseImage, {
            contentType: courseImage.type,
            upsert: false,
            cacheControl: "3600",
          });

        if (uploadError)
          throw new Error(`Image upload failed: ${uploadError.message}`);

        const { data: publicData } = supabase.storage
          .from("course-images")
          .getPublicUrl(uploadedPath);
        imageUrl = publicData.publicUrl;
      }

      const coursePayload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        category: formData.category.trim() || "General",
        teacher_id: formData.teacher_id,
        suggested_price: suggestedPrice,
        image_url: imageUrl,
        teacher_revenue_model: formData.teacher_revenue_model,
        teacher_pool_percent: teacherPoolPercent,
      };

      const query = editCourse
        ? await supabase
            .from("courses")
            .update(coursePayload)
            .eq("id", editCourse.id)
        : await supabase
            .from("courses")
            .insert({ ...coursePayload, admin_status: "approved" });

      if (query.error) {
        throw new Error(
          `${editCourse ? "Course update" : "Course creation"} failed: ${
            query.error.message
          }`,
        );
      }

      toast.success(
        editCourse
          ? "Course updated successfully."
          : "Course created successfully.",
      );
      setDialogOpen(false);
      resetCourseForm();
      await fetchCourses();
    } catch (error) {
      console.error("Save course error:", error);
      if (uploadedPath) {
        const { error: cleanupError } = await supabase.storage
          .from("course-images")
          .remove([uploadedPath]);
        if (cleanupError) console.error("Image cleanup failed:", cleanupError);
      }
      toast.error(
        error instanceof Error ? error.message : "Could not save course.",
      );
    } finally {
      setSavingCourse(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this course?")) return;

    const { error } = await supabase.from("courses").delete().eq("id", id);

    if (error) {
      toast.error("Could not delete course.");
      return;
    }

    toast.success("Course deleted");

    fetchCourses();
  };

  const updateStatus = async (course: any, status: string) => {
    const { error } = await supabase.rpc("admin_manage_course", {
      p_course_id: course.id,

      p_status: status,
    });

    if (error) {
      toast.error("Could not update course status.");
      return;
    }

    toast.success(`Course ${status.replace("_", " ")}`);

    fetchCourses();

    if (reviewCourse?.id === course.id) setReviewDialogOpen(false);
  };

  const openReview = (course: any) => {
    setReviewCourse(course);

    setReviewForm({
      final_price: String(course.suggested_price || 0),
      rejection_reason: "",
    });

    setReviewDialogOpen(true);
  };

  const approveWithPrice = async () => {
    if (!reviewCourse) return;

    const price = Math.max(0, Number(reviewForm.final_price));

    const { error } = await supabase.rpc("admin_manage_course", {
      p_course_id: reviewCourse.id,

      p_status: "approved",

      p_final_price: price,
    });

    if (error) {
      toast.error("Could not approve course.");
      return;
    }

    toast.success("Course approved with final price");

    setReviewDialogOpen(false);

    fetchCourses();
  };

  const rejectCourse = async () => {
    if (!reviewCourse) return;

    const { error } = await supabase.rpc("admin_manage_course", {
      p_course_id: reviewCourse.id,

      p_status: "rejected",

      p_rejection_reason:
        reviewForm.rejection_reason || "Please revise and resubmit.",
    });

    if (error) {
      toast.error("Could not reject course.");
      return;
    }

    toast.success("Course rejected");

    setReviewDialogOpen(false);

    fetchCourses();
  };

  const openDiscount = (course: any) => {
    setDiscountCourse(course);

    setDiscountForm({
      discount_price: String(course.discount_price || 0),

      discount_active: course.discount_active || false,

      discount_expires_at: course.discount_expires_at
        ? course.discount_expires_at.slice(0, 16)
        : "",
    });

    setDiscountDialogOpen(true);
  };

  const saveDiscount = async () => {
    if (!discountCourse) return;

    const { error } = await supabase.rpc("admin_manage_course", {
      p_course_id: discountCourse.id,

      p_discount_price: Math.max(0, Number(discountForm.discount_price)),

      p_discount_active: discountForm.discount_active,

      p_discount_expires_at: discountForm.discount_expires_at
        ? new Date(discountForm.discount_expires_at).toISOString()
        : null,
    });

    if (error) {
      toast.error("Could not update discount.");
      return;
    }

    toast.success("Discount updated");

    setDiscountDialogOpen(false);

    fetchCourses();
  };

  if (loading || dataLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
      </div>
    );
  }

  const filtered = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()),
  );

  const totalEarnings = Object.values(earnings).reduce(
    (sum, e) => sum + e.total,
    0,
  );

  const totalEnrollments = Object.values(earnings).reduce(
    (sum, e) => sum + e.count,
    0,
  );

  return (
    <DashboardShell role="admin">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Course Management
          </h1>

          <p className="text-sm text-slate-500">
            Review, approve, set prices, manage discounts and earnings
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button
            onClick={openCreateCourse}
            className="bg-sky-500 hover:bg-sky-600 text-white shadow-md"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Course
          </Button>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editCourse ? "Edit Course" : "Create New Course"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Course Title</Label>

                <Input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Introduction to Mathematics"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>

                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Course description..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="course-image">Course Cover Image</Label>
                <label
                  htmlFor="course-image"
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-sky-400 hover:bg-sky-50"
                >
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Course cover preview"
                      className="max-h-48 w-full rounded-lg object-cover"
                    />
                  ) : (
                    <>
                      <ImagePlus className="mb-2 h-8 w-8 text-sky-500" />
                      <span className="text-sm font-semibold text-slate-700">
                        Upload course image
                      </span>
                      <span className="mt-1 text-xs text-slate-500">
                        JPG, PNG, WebP, or AVIF · Maximum 5 MB
                      </span>
                    </>
                  )}
                </label>
                <Input
                  id="course-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="cursor-pointer"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (
                      ![
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/avif",
                      ].includes(file.type)
                    ) {
                      toast.error("Use a JPG, PNG, WebP, or AVIF image.");
                      event.target.value = "";
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be 5 MB or smaller.");
                      event.target.value = "";
                      return;
                    }
                    setImagePreview((previous) => {
                      if (previous?.startsWith("blob:"))
                        URL.revokeObjectURL(previous);
                      return URL.createObjectURL(file);
                    });
                    setCourseImage(file);
                    setImageRemoved(false);
                  }}
                />
                {courseImage && (
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
                    <span className="truncate">{courseImage.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setCourseImage(null);
                        setImageRemoved(true);
                        setImagePreview((previous) => {
                          if (previous?.startsWith("blob:"))
                            URL.revokeObjectURL(previous);
                          return null;
                        });
                        const input = document.getElementById(
                          "course-image",
                        ) as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                    >
                      Remove image
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>

                  <Input
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Suggested Price (₹)</Label>

                  <Input
                    type="number"
                    min="0"
                    value={formData.suggested_price}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        suggested_price: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign Teacher</Label>

                <select
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  value={formData.teacher_id}
                  onChange={(e) =>
                    setFormData({ ...formData, teacher_id: e.target.value })
                  }
                >
                  <option value="">Select a teacher...</option>

                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="teacher-revenue-model">Teacher Revenue Model</Label>
                  <select
                    id="teacher-revenue-model"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                    value={formData.teacher_revenue_model}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        teacher_revenue_model: e.target.value as "lecture" | "hour",
                      })
                    }
                  >
                    <option value="lecture">By eligible lecture count</option>
                    <option value="hour">By eligible teaching minutes</option>
                  </select>
                  <p className="text-xs text-slate-500">
                    Only published, earning-eligible, non-demo lectures count.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teacher-pool-percent">Teacher Pool (%)</Label>
                  <Input
                    id="teacher-pool-percent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.teacher_pool_percent}
                    onChange={(e) =>
                      setFormData({ ...formData, teacher_pool_percent: e.target.value })
                    }
                    required
                  />
                  <p className="text-xs text-slate-500">
                    Example: 50 means half of eligible course revenue is allocated to teachers.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  resetCourseForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveCourse}
                disabled={savingCourse}
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                {savingCourse && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {savingCourse
                  ? editCourse
                    ? "Saving..."
                    : "Creating..."
                  : editCourse
                  ? "Save Changes"
                  : "Create Course"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary stats */}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Teacher Earnings</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  ₹{totalEarnings.toFixed(2)}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Paid Enrollments</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {totalEnrollments}
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                <Users className="h-5 w-5 text-sky-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pending Review</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {
                    courses.filter((c) => c.admin_status === "pending_review")
                      .length
                  }
                </p>
              </div>

              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Card
            key={c.id}
            className="border-slate-200 shadow-sm transition-all hover:shadow-md"
          >
            <CardContent className="p-5">
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={`${c.title} course cover`}
                  loading="lazy"
                  className="mb-4 h-40 w-full rounded-xl object-cover"
                />
              ) : (
                <div className="mb-4 flex h-40 w-full items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-blue-100">
                  <BookOpen className="h-12 w-12 text-sky-500" />
                </div>
              )}

              <div className="mb-3 flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100">
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={statusStyles[c.admin_status]}>
                    {c.admin_status.replace("_", " ")}
                  </Badge>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditCourse(c)}
                    aria-label={`Edit ${c.title}`}
                    title="Edit course"
                    className="text-slate-500 hover:text-sky-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(c.id)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900">{c.title}</h3>

              <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                {c.description || "No description"}
              </p>

              <div className="mt-3 space-y-1 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Teacher: {c.profiles?.full_name || "Unknown"}</span>

                  <Badge variant="outline">{c.category}</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span>Suggested: ₹{c.suggested_price || 0}</span>

                  <span className="font-medium text-sky-600">
                    Final: ₹{c.final_price || 0}
                  </span>
                </div>

                {c.discount_active && c.discount_price > 0 && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <Tag className="h-3 w-3" /> Discount: ₹{c.discount_price}
                  </div>
                )}

                {earnings[c.id] && earnings[c.id].count > 0 && (
                  <div className="flex items-center gap-1 text-emerald-600">
                    <IndianRupee className="h-3 w-3" /> Earnings: ₹
                    {earnings[c.id].total.toFixed(2)} ({earnings[c.id].count}{" "}
                    paid)
                  </div>
                )}
              </div>

              {c.admin_status === "rejected" && c.rejection_reason && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
                  {c.rejection_reason}
                </p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRevenueCourse(c)}
                  className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Users className="mr-1 h-3.5 w-3.5" /> Teacher Shares
                </Button>
                {c.admin_status === "pending_review" && (
                  <Button
                    size="sm"
                    onClick={() => openReview(c)}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Review
                  </Button>
                )}

                {c.admin_status === "approved" && (
                  <Button
                    size="sm"
                    onClick={() => updateStatus(c, "published")}
                    className="bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Publish
                  </Button>
                )}

                {c.admin_status === "published" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus(c, "unpublished")}
                  >
                    <EyeOff className="mr-1 h-3.5 w-3.5" /> Unpublish
                  </Button>
                )}

                {c.admin_status === "unpublished" && (
                  <Button
                    size="sm"
                    onClick={() => updateStatus(c, "published")}
                    className="bg-sky-500 hover:bg-sky-600 text-white"
                  >
                    <Eye className="mr-1 h-3.5 w-3.5" /> Republish
                  </Button>
                )}

                {(c.admin_status === "published" ||
                  c.admin_status === "approved" ||
                  c.admin_status === "unpublished") && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReview(c)}
                  >
                    <IndianRupee className="mr-1 h-3.5 w-3.5" /> Set Price
                  </Button>
                )}

                {(c.admin_status === "published" ||
                  c.admin_status === "approved") &&
                  c.final_price > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDiscount(c)}
                    >
                      <Tag className="mr-1 h-3.5 w-3.5" /> Discount
                    </Button>
                  )}
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-slate-500">
            No courses found.
          </div>
        )}
      </div>

      {/* Teacher revenue sharing dialog */}
      <Dialog
        open={Boolean(revenueCourse)}
        onOpenChange={(open) => {
          if (!open) setRevenueCourse(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {revenueCourse && (
            <CourseTeacherRevenueEditor
              courseId={revenueCourse.id}
              courseTitle={revenueCourse.title}
              teacherPoolPercent={Number(revenueCourse.teacher_pool_percent ?? 50)}
              revenueModel={revenueCourse.teacher_revenue_model === "hour" ? "hour" : "lecture"}
              coursePrice={Number(
                revenueCourse.discount_active && Number(revenueCourse.discount_price) > 0
                  ? revenueCourse.discount_price
                  : revenueCourse.final_price || revenueCourse.suggested_price || 0
              )}
              onSaved={() => {
                void fetchCourses();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Review dialog */}

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Course</DialogTitle>
          </DialogHeader>

          {reviewCourse && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {reviewCourse.title}
                </h3>

                <p className="text-sm text-slate-500">
                  {reviewCourse.description || "No description"}
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  Suggested price: ₹{reviewCourse.suggested_price || 0}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Final Price (₹)</Label>

                <Input
                  type="number"
                  min="0"
                  value={reviewForm.final_price}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      final_price: e.target.value,
                    })
                  }
                />

                <p className="text-xs text-slate-400">
                  Set 0 for a free course. This is what students will pay.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rejection Reason (only if rejecting)</Label>

                <Textarea
                  value={reviewForm.rejection_reason}
                  onChange={(e) =>
                    setReviewForm({
                      ...reviewForm,
                      rejection_reason: e.target.value,
                    })
                  }
                  placeholder="Reason for rejection..."
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              variant="outline"
              onClick={rejectCourse}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="mr-2 h-4 w-4" /> Reject
            </Button>

            <Button
              onClick={approveWithPrice}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              <Check className="mr-2 h-4 w-4" /> Approve & Set Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discount dialog */}

      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Discount</DialogTitle>
          </DialogHeader>

          {discountCourse && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold text-slate-900">
                  {discountCourse.title}
                </h3>

                <p className="text-sm text-slate-600">
                  Current final price: ₹{discountCourse.final_price || 0}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Discount Price (₹)</Label>

                <Input
                  type="number"
                  min="0"
                  value={discountForm.discount_price}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      discount_price: e.target.value,
                    })
                  }
                />

                <p className="text-xs text-slate-400">
                  Students pay this price instead of the final price.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="discount-active"
                  type="checkbox"
                  checked={discountForm.discount_active}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      discount_active: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-sky-500"
                />

                <Label htmlFor="discount-active">Activate discount now</Label>
              </div>

              <div className="space-y-2">
                <Label>Expiry Date (optional)</Label>

                <Input
                  type="datetime-local"
                  value={discountForm.discount_expires_at}
                  onChange={(e) =>
                    setDiscountForm({
                      ...discountForm,
                      discount_expires_at: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDiscountDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button
              onClick={saveDiscount}
              className="bg-sky-500 hover:bg-sky-600 text-white"
            >
              Save Discount
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}
