// The ids Home's jump targets give their `h2`, shared by the server sections and the client
// "تسوّق الآن" link, so focus lands on the section's title (spec 0011 AC-3).
export const sectionHeadingId = (section: string) => `${section}-title`;
