# Tableleaf — making restaurant menus clearer

## Problem

A takeaway menu needs to express more than a dish name and price. Guests need ingredients and useful allergen information, while the restaurant needs to keep the menu current, make it look like its brand and publish it in several places.

## Product

Tableleaf pairs a restaurant editor with a live customer menu. Categories and dishes form an editable local draft. Restaurant staff explicitly review ingredient, allergen and dietary declarations. The guest can highlight options matching those declarations, inspect uncertainty and read the full details before discussing an order with staff.

The restaurant can download an editable JSON backup, a standalone interactive menu, a sandboxed embed snippet or a complete print/PDF version.

## Important design decisions

- **Unknown is a real state.** A blank or unreviewed field must not be interpreted as allergen absence. Direct presence, possible cross-contact, reviewed absence and missing review remain distinct.
- **Declarations have a lifecycle.** Changing an ingredient list or duplicating a dish resets reviews. This prevents old claims from silently following a different recipe.
- **Dietary claims are explicit.** The app does not guess vegan or gluten-free status from a description. Conflicting milk/gluten and dietary declarations block publishing.
- **One set of customer rules.** The editor preview and exported menu execute the same self-contained engine and renderer. This avoids differences between what the owner checks and what the customer sees.
- **Portable publication.** The HTML includes its own styles, filtering code and embedded logo. No account, subscription or external runtime API is required.
- **A separation between menu data and customer preferences.** The restaurant's draft stays in localStorage; guest allergy selections stay only in memory.
- **A useful limit to the promise.** The interface says that a match reflects restaurant declarations, not a safety guarantee. It always keeps the need for a conversation with the kitchen visible.

## Tradeoffs

Exports are snapshots and must be replaced when recipes change. There is no ordering flow, stock synchronization or centrally hosted restaurant account. The first release uses the broad EU allergen groups and cannot model every food allergy or regulatory exception.

The JSON file is the editable document. The app validates imported schemas, limits size and accepts only embedded raster logos. Customer text is escaped separately for HTML, JavaScript data and iframe attributes.

## Freelance relevance

This is a complete small-business workflow: structured editing, domain-specific validation, branded customer presentation, local persistence and multiple publishing formats. It demonstrates care around ambiguous information and the consistency of business rules across delivery surfaces.

An independent portfolio project using fictional restaurant data, not a commissioned restaurant system or a certified food-safety product.
