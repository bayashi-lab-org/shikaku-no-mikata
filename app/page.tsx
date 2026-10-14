import { Metadata } from "next";
import { getAllPosts, getAllCategories } from "@/lib/mdx";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";
import HeroSection from "@/components/home/HeroSection";
import CategoryGrid from "@/components/home/CategoryGrid";
import FeaturedArticle from "@/components/home/FeaturedArticle";
import QuickFinder from "@/components/home/QuickFinder";
import LatestArticles from "@/components/home/LatestArticles";
import CtaSection from "@/components/home/CtaSection";

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
};

function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    description: SITE_DESCRIPTION,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function HomePage() {
  const posts = getAllPosts();
  const categories = getAllCategories();
  const featuredPost = posts.find((p) => p.featured);
  const latestPosts = posts.slice(0, 6);

  return (
    <>
      <OrganizationJsonLd />
      <HeroSection
        totalPosts={posts.length}
        totalCategories={categories.length}
      />
      <CategoryGrid categoryCounts={categories} />
      {featuredPost && <FeaturedArticle post={featuredPost} />}
      <QuickFinder posts={posts} />
      <LatestArticles posts={latestPosts} />
      <CtaSection />
    </>
  );
}
