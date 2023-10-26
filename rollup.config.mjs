import {defineConfig} from "rollup";
import esbuild from "rollup-plugin-esbuild";
import json from "@rollup/plugin-json";

export default defineConfig([
	{
		input: "scripts/workerTesting.ts",
		output: [
			{
				file: "dist/workerTesting.mjs",
				format: "esm"
			},
			{
				file: "dist/workerTesting.cjs",
				format: "cjs",
			}
		],
		plugins: [
			esbuild({
				include: /\.[jt]sx?$/,
				exclude: /node_modules/,
				tsconfig: "tsconfig.json",
			}),
		]
	},
]);
