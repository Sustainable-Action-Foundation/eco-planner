"use client";

// import type { Metadata } from "next";
import SelectSingleTree from "@/components/form/elements/combobox/selectSingleTree";
import SelectMultipleSearch from "@/components/form/elements/combobox/selectMultipleSearch";
import SelectSingleSearch from "@/components/form/elements/combobox/selectSingleSearch";
import TextSingleAutocomplete from "@/components/form/elements/combobox/textSingleAutocomplete";
import { useState } from "react";

{/*
export async function generateMetadata(): Promise<Metadata> {
  const t = await serveTea("pages");

  return buildMetadata({
    title: t("pages:info.title"),
    description: t("pages:info.info_body"),
    og_url: `/info`,
    og_image_url: undefined,
  });
}
*/}

export default function Page() {
  const [suggestion, setSuggestion] = useState<string>('');
  return (
    <div className="grid gap-200 margin-top-500 padding-top-500" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '20%' }}>
      <SelectSingleTree
        props={{
          id: 'select-tree',
          name: 'select-tree',
          placeholder: 'treeitem',
        }}
        treeItems={[
          {
            name: 'Item 1',
            value: 'Item 1',
            expanded: false,
            childNodes: [
              {
                name: 'Item 1.1',
                value: 'Item 1.1',
                expanded: false,
                childNodes: [
                  {
                    name: 'Item 1.1.1',
                    value: 'Item 1.1.1',
                    expanded: null,
                  }, {
                    name: 'Item 1.1.2',
                    value: 'Item 1.1.2',
                    expanded: null,
                  }, {
                    name: 'Item 1.1.3',
                    value: 'Item 1.1.3',
                    expanded: null,
                  },
                ],
              },
              {
                name: 'Item 1.2',
                value: 'Item 1.2',
                expanded: null,
              },
              {
                name: 'Item 1.3',
                value: 'Item 1.3',
                expanded: null,
              },
            ],
          },
        ]}
      />
      <TextSingleAutocomplete
        props={{
          id: 'suggestions',
          name: 'suggestions',
          placeholder: 'Text suggestions',
        }}
        options={[
          { name: 'option 1', value: 'option 1' },
          { name: 'option 2', value: 'option 2' },
          { name: 'option 3', value: 'option 3' },
          { name: 'option 4', value: 'option 4' },
          { name: 'option 5', value: 'option 5' },
        ]}
        value={suggestion}
        setter={setSuggestion}
      />
      <SelectMultipleSearch
        props={{
          id: 'select-multiple',
          name: 'select-multiple',
          placeholder: 'Select multiple',
        }}
        options={[
          { name: 'option 1', value: 'option 1' },
          { name: 'option 2', value: 'option 2' },
          { name: 'option 3', value: 'option 3' },
          { name: 'option 4', value: 'option 4' },
          { name: 'option 5', value: 'option 5' },
        ]}
      />
      <SelectSingleSearch
        props={{
          id: 'select-single',
          name: 'select-single',
          placeholder: 'Select single',
        }}
        options={[
          { name: 'option 1', value: 'option 1' },
          { name: 'option 2', value: 'option 2' },
          { name: 'option 3', value: 'option 3' },
          { name: 'option 4', value: 'option 4' },
          { name: 'option 5', value: 'option 5' },
        ]}
      />
    </div>
  );
}