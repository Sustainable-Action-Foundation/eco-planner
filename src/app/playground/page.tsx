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
    <form className="grid gap-200 margin-top-500 padding-top-500" style={{ gridTemplateColumns: '1fr 1fr', marginTop: '20%' }}>
      <SelectSingleTree
        props={{
          id: 'select-tree',
          name: 'select-tree',
          placeholder: 'treeitem',
          required: true,
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
          {
            name: 'Item 2',
            value: 'Item 2',
            expanded: false,
            childNodes: [
              {
                name: 'Item 2.1',
                value: 'Item 2.1',
                expanded: false,
                childNodes: [
                  {
                    name: 'Item 2.1.1',
                    value: 'Item 2.1.1',
                    expanded: null,
                  }, {
                    name: 'Item 2.1.2',
                    value: 'Item 2.1.2',
                    expanded: null,
                  }, {
                    name: 'Item 2.1.3',
                    value: 'Item 2.1.3',
                    expanded: null,
                  },
                ],
              },
              {
                name: 'Item 2.2',
                value: 'Item 2.2',
                expanded: null,
              },
              {
                name: 'Item 2.3',
                value: 'Item 2.3',
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
          required: true,
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
          required: true,
        }}
        options={[
          { name: 'option 1', value: 'option 1' },
          { name: 'option 2', value: 'option 2' },
          { name: 'option 3', value: 'option 3' },
          { name: 'option 4', value: 'option 4' },
          { name: 'option 5', value: 'option 5' },
          { name: 'option 6', value: 'option 6' },
          { name: 'option 7', value: 'option 7' },
        ]}
      />
      <SelectSingleSearch
        props={{
          id: 'select-single',
          name: 'select-single',
          placeholder: 'Select single',
          required: true,
        }}
        options={[
          { name: 'option 1', value: 'option 1' },
          { name: 'option 2', value: 'option 2' },
          { name: 'option 3', value: 'option 3' },
          { name: 'option 4', value: 'option 4' },
          { name: 'option 5', value: 'option 5' },
          { name: 'option 6', value: 'option 6' },
          { name: 'option 7', value: 'option 7' },
        ]}
      />
      <input type="submit" value={"Submit form!"}/>
    </form>
  );
}