import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuestions } from "@/hooks/use-questions";
import { useQuiz } from "@/lib/quiz-context";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

const LOGO_URL = "https://res.cloudinary.com/dkhgsi8l7/image/upload/v1773061809/logo_edited_vlgoqy.jpg";

const CATEGORIES = [
  { value: "1", label: "Category 1 - Rules of the Road" },
  { value: "2", label: "Category 2 - Road signs" },
  { value: "3", label: "Category 3 - Vehicle controls" },
];

export default function Home() {
  const [_, setLocation] = useLocation();
  const { data: questions, isLoading, isError } = useQuestions();
  const { startQuiz } = useQuiz();

  const availableLicenseCodes = questions
    ? Array.from(new Set(questions.map((q) => q.license_code)))
      .filter((code) => code !== "00")
      .sort()
    : [];

  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    licenseCode: "",
    category: "",
    accessCode: "",
  });

  const [accessCodeValidated, setAccessCodeValidated] = useState(false);
  const [accessCodeError, setAccessCodeError] = useState("");
  const [validatingCode, setValidatingCode] = useState(false);

  useEffect(() => {
    const savedCode = sessionStorage.getItem("k53_access_code");
    if (savedCode) {
      setFormData((prev) => ({ ...prev, accessCode: savedCode }));
      setAccessCodeValidated(true);
    }
  }, []);

  const isFormValid =
    formData.name &&
    formData.surname &&
    formData.licenseCode &&
    formData.category &&
    accessCodeValidated;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !questions) return;

    startQuiz(
      {
        name: formData.name,
        surname: formData.surname,
        licenseCode: formData.licenseCode,
        category: parseInt(formData.category, 10),
      },
      questions
    );

    setLocation("/quiz");
  };

  const handleValidateCode = async () => {
    if (!formData.accessCode || formData.accessCode.length !== 6) {
      setAccessCodeError("Please enter a 6-character alphanumeric code.");
      return;
    }
    setValidatingCode(true);
    setAccessCodeError("");
    try {
      const res = await fetch("/api/access-code/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: formData.accessCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setAccessCodeValidated(true);
        sessionStorage.setItem("k53_access_code", formData.accessCode);
      } else {
        setAccessCodeError("Invalid access code. Please try again.");
      }
    } catch {
      setAccessCodeError("Failed to validate code. Please try again.");
    } finally {
      setValidatingCode(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center py-8 px-4">
        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Logo */}
          <div className="mb-2">
            <img
              src={LOGO_URL}
              alt="Jean's Driving School"
              className="h-24 md:h-32 w-auto object-contain border-0"
            />
          </div>

          {/* Updated Syllabus Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            {new Date().getFullYear()} Updated Syllabus
          </div>

          {/* Headline */}
          <h1 className="text-3xl md:text-4xl font-display font-extrabold text-foreground tracking-tight leading-tight max-w-sm md:max-w-md">
            Pass your K53 test{" "}
            <span
              className="text-transparent bg-clip-text"
              style={{ backgroundImage: "linear-gradient(90deg, #E53E1A, #F5A623)" }}
            >
              with confidence
            </span>
          </h1>

          <p className="text-sm md:text-base text-muted-foreground max-w-xs md:max-w-sm">
            Professional practice tests tailored to your license code and vehicle category.
          </p>
        </div>

        {/* Form Card */}
        <Card
          className="w-full max-w-md glass-card border-none shadow-2xl rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: "100ms" }}
        >
          {/* Card header stripe */}
          <div
            className="h-1.5 rounded-t-3xl"
            style={{ background: "linear-gradient(90deg, #E53E1A, #F5A623)" }}
          />

          <CardContent className="pt-6 pb-8 px-6">
            <h2 className="text-xl font-display font-bold text-foreground mb-1">
              Candidate Details
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your details to start your practice test.
            </p>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <div
                  className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: "#E53E1A", borderTopColor: "transparent" }}
                />
                <p className="text-muted-foreground font-medium text-sm">
                  Loading question bank...
                </p>
              </div>
            ) : isError ? (
              <div className="p-4 rounded-xl bg-destructive/10 text-destructive text-center text-sm">
                Failed to load questions. Please check your connection and try again.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Access Code */}
                <div className="space-y-1.5">
                  <Label htmlFor="accessCode" className="flex items-center gap-2 text-sm font-semibold">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Access Code
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="accessCode"
                      placeholder="Enter 6-character code"
                      value={formData.accessCode}
                      onChange={(e) => {
                        const val = e.target.value
                          .replace(/[^a-zA-Z0-9]/g, "")
                          .toUpperCase()
                          .slice(0, 6);
                        setFormData((prev) => ({ ...prev, accessCode: val }));
                        if (accessCodeValidated) {
                          setAccessCodeValidated(false);
                          sessionStorage.removeItem("k53_access_code");
                        }
                        setAccessCodeError("");
                      }}
                      maxLength={6}
                      className={`h-11 bg-background/60 focus:bg-background transition-colors font-mono text-base tracking-[0.25em] ${accessCodeValidated
                        ? "border-green-500 bg-green-50/50"
                        : accessCodeError
                          ? "border-red-500"
                          : ""
                        }`}
                      disabled={accessCodeValidated}
                    />
                    {!accessCodeValidated ? (
                      <Button
                        type="button"
                        onClick={handleValidateCode}
                        disabled={validatingCode || formData.accessCode.length !== 6}
                        className="h-11 px-5 text-sm font-bold"
                        style={{
                          background: "linear-gradient(135deg, #E53E1A, #F5A623)",
                          border: "none",
                        }}
                      >
                        {validatingCode ? "Verifying..." : "Verify"}
                      </Button>
                    ) : (
                      <div className="h-11 flex items-center px-3 text-green-600 font-semibold text-sm gap-1 whitespace-nowrap">
                        <ShieldCheck className="h-4 w-4" />
                        Verified
                      </div>
                    )}
                  </div>
                  {accessCodeError && (
                    <p className="text-xs text-red-500 mt-1">{accessCodeError}</p>
                  )}
                </div>

                {/* Name + Surname */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm font-semibold">
                      First Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="John"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="h-11 bg-background/60 focus:bg-background transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="surname" className="text-sm font-semibold">
                      Surname
                    </Label>
                    <Input
                      id="surname"
                      placeholder="Doe"
                      value={formData.surname}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, surname: e.target.value }))
                      }
                      className="h-11 bg-background/60 focus:bg-background transition-colors"
                    />
                  </div>
                </div>

                {/* License Code + Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="licenseCode" className="text-sm font-semibold">
                      License Code
                    </Label>
                    <Select
                      value={formData.licenseCode}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, licenseCode: val }))
                      }
                    >
                      <SelectTrigger id="licenseCode" className="h-11 bg-background/60">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLicenseCodes.map((code) => {
                          let label = `Code ${code}`;
                          if (code === "01") label += " (Motorcycles)";
                          else if (code === "02") label += " (Light Motor)";
                          else if (code === "03") label += " (Heavy Motor)";
                          return (
                            <SelectItem key={code} value={code}>
                              {label}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="category" className="text-sm font-semibold">
                      Vehicle Category
                    </Label>
                    <Select
                      value={formData.category}
                      onValueChange={(val) =>
                        setFormData((prev) => ({ ...prev, category: val }))
                      }
                    >
                      <SelectTrigger id="category" className="h-11 bg-background/60">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  id="start-test-btn"
                  disabled={!isFormValid}
                  className="w-full h-13 text-base font-bold rounded-xl shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl mt-2"
                  style={{
                    background: isFormValid
                      ? "linear-gradient(135deg, #E53E1A 0%, #F5A623 100%)"
                      : undefined,
                    border: "none",
                    height: "52px",
                  }}
                >
                  Start Practice Test
                </Button>
              </form>
            )}
          </CardContent>
        </Card>


      </div>
    </Layout>
  );
}
