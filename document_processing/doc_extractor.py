"""
Doc extractor
=============

AI-only extraction helpers. This module provides:
 - ``extract_fields``: text-to-JSON extraction using OpenAI chat models
 - ``extract_fields_from_image``: vision extraction directly from images/PDFs
 - ``extract_fields_from_image_async``: async variant of vision extraction

Set the ``OPENAI_API_KEY`` environment variable before calling these functions.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from pathlib import Path
from typing import Optional, Union

from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from openai import OpenAI
from PIL import Image
from pdf2image import convert_from_bytes

from .config import get_config

logger = logging.getLogger("doc_ai_extractor")

__all__ = [
	"extract_fields",
	"extract_fields_from_image",
	"extract_fields_from_image_async",
]


def extract_fields(
	text: str,
	instructions: str,
	model: Optional[ChatOpenAI] = None,
	max_output_chars: int = 3000,
) -> dict:
	"""Use an LLM to extract structured data from text based on instructions.

	The caller must provide a set of extraction instructions (for example
	those returned from ``get_instructions_for_type`` in
	``doc_classifier``).  The LLM is prompted with the instructions and
	the text and is asked to produce a JSON object.  The result is
	parsed into a Python dictionary.  If parsing fails, an empty
	dictionary is returned.

	Args:
		text: Raw text extracted from the document.
		instructions: String describing what to extract and how to format
			the JSON response.
		model: Optional ``ChatOpenAI`` instance.  If omitted a default
			model is constructed using environment variables.
		max_output_chars: Limit the amount of text passed to the LLM to
			avoid extremely long prompts.  The first ``max_output_chars``
			characters of ``text`` will be used.

	Returns:
		A dictionary containing the extracted fields.  If the model
		returns invalid JSON an empty dict is returned.
	"""
	if model is None:
		config = get_config()
		if (config.model_name or "").lower() == "gpt-5":
			# gpt-5: use temperature=1 and max_completion_tokens instead of max_tokens
			model = ChatOpenAI(
				openai_api_key=config.openai_api_key,
				openai_api_base=config.openai_api_base,
				model_name=config.model_name,
				temperature=1.0,
				max_completion_tokens=1200,
			)
		else:
			model = ChatOpenAI(
				openai_api_key=config.openai_api_key,
				openai_api_base=config.openai_api_base,
				temperature=0.0,
				model_name=config.model_name,
				max_tokens=2048,
			)

	# Build the prompt instructing the model to follow instructions and return JSON
	prompt = ChatPromptTemplate.from_template(
		"""
		You are an information extraction assistant. Follow the instructions
		carefully to extract data from the provided document text. When you
		extract data, respond only with a valid JSON object. Do not include
		any additional commentary.

		Instructions:
		{instructions}

		Document text:
		{text}
		"""
	)
	formatted_prompt = prompt.format(
		instructions=instructions,
		text=text[:max_output_chars],
	)
	raw_response = model.invoke(formatted_prompt)
	try:
		return json.loads(raw_response.content)
	except Exception:
		logger.warning("extract_fields: model returned non-JSON content, returning empty dict")
		return {}


def extract_fields_from_image(
	image_path: Union[str, Path],
	instructions: str,
	model_name: Optional[str] = None,
	max_output_chars: int = 3000,
) -> dict:
	"""Use OpenAI Vision to extract JSON directly from an image.

	Args:
		image_path: Path to image file (jpg/png/jpeg/tif/tiff/pdf/tmp).
		instructions: Extraction instruction text.
		model_name: Optional model override (defaults to env MODEL_NAME).
		max_output_chars: Truncation for instructions to keep prompt bounded.
	"""
	path = Path(image_path)
	if not path.exists():
		return {}

	# For temp files, try to process regardless of extension
	suffix = path.suffix.lower()
	if suffix and suffix not in {".jpg", ".jpeg", ".png", ".tif", ".tiff", ".pdf", ".tmp"}:
		logger.warning("Unsupported file extension %s, trying anyway", suffix)

	with open(path, "rb") as f:
		raw_bytes = f.read()
		b64 = base64.b64encode(raw_bytes).decode("utf-8")

	config = get_config()
	# Sniff MIME type and convert PDFs to image bytes for vision
	mime = "image/jpeg"
	try:
		if raw_bytes.startswith(b"%PDF"):
			# Convert first page of PDF to JPEG bytes for vision
			try:
				images = convert_from_bytes(raw_bytes, first_page=1, last_page=1)
				buf = __import__("io").BytesIO()
				images[0].save(buf, format="JPEG")
				raw_bytes = buf.getvalue()
				b64 = base64.b64encode(raw_bytes).decode("utf-8")
				mime = "image/jpeg"
			except Exception:
				mime = "image/jpeg"  # fallback, may fail downstream
		else:
			try:
				from PIL import Image as _Img
				with _Img.open(path) as im:
					fmt = (im.format or "JPEG").upper()
					if fmt == "PNG":
						mime = "image/png"
					elif fmt in {"JPEG", "JPG"}:
						mime = "image/jpeg"
					elif fmt in {"TIFF", "TIF"}:
						mime = "image/tiff"
			except Exception:
				mime = "image/jpeg"
	except Exception:
		mime = "image/jpeg"

	model = model_name or config.vision_model_name or config.model_name
	client = OpenAI(api_key=config.openai_api_key, base_url=config.openai_api_base)

	system_prompt = (
		"You are a document data extraction expert. "
		"You will receive an image of a document and extraction instructions. "
		"Your ONLY job is to return a valid JSON object with the extracted data. "
		"CRITICAL: Never return an empty JSON object {}. "
		"If you cannot read something clearly, make your best guess or use 'Unknown'. "
		"Use exactly the field names shown in the extraction template."
	)

	try:
		logger.info("Sending image to GPT Vision for extraction, model: %s", model)
		resp = client.chat.completions.create(
			model=model,
			messages=[
				{"role": "system", "content": system_prompt},
				{
					"role": "user",
					"content": [
						{
							"type": "text",
							"text": (
								"Look at this document image carefully. Extract the following "
								f"data and return ONLY a JSON object:\n\n"
								f"{instructions[:max_output_chars]}\n\n"
								"IMPORTANT: Always return a JSON object, even if you can only "
								"extract partial information. Do not return empty objects."
							),
						},
						{"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
					],
				},
			],
			response_format={"type": "json_object"},
			max_completion_tokens=1200,
		)
		content = resp.choices[0].message.content or "{}"
		logger.info(
			"Vision response: %s", content[:200] + "..." if len(content) > 200 else content
		)

		try:
			parsed = json.loads(content)
			if parsed:
				logger.info(
					"Successfully parsed vision extraction result with %d fields", len(parsed)
				)
				return parsed
			else:
				logger.warning("GPT returned empty JSON, trying fallback")
		except Exception as parse_error:
			logger.warning("Failed to parse JSON response: %s", parse_error)
			# Attempt to strip code fences if present
			cleaned = content.strip().strip("`").strip("json").strip("`")
			try:
				parsed = json.loads(cleaned)
				if parsed:
					logger.info(
						"Successfully parsed cleaned vision extraction result with %d fields",
						len(parsed),
					)
					return parsed
			except Exception:
				logger.error("Failed to parse even cleaned JSON response: %s", cleaned[:100])

		# Build a minimal placeholder from instruction keys if possible
		try:
			import re as _re
			keys = _re.findall(r'"([A-Za-z0-9_]+)"\s*:', instructions)
			if keys:
				placeholder = {k: "" for k in keys}
				logger.warning("Returning placeholder JSON with %d keys from instructions", len(keys))
				return placeholder
		except Exception:
			pass

		logger.error("Vision extraction completely failed - model returned empty or invalid JSON")
		return {}
	except Exception as e:
		logger.exception("Vision extraction failed with error: %s", e)
		return {}


async def extract_fields_from_image_async(
	image_path: Union[str, Path],
	instructions: str,
	model_name: Optional[str] = None,
	max_output_chars: int = 3000,
) -> dict:
	"""Async variant of image extraction using OpenAI's async API.

	This is currently not wired into the pipeline but can be used by async callers.
	"""
	try:
		from openai import AsyncOpenAI  # type: ignore
	except Exception:
		logger.warning("AsyncOpenAI not available; falling back to sync path in thread")
		# In absence of async client, run sync in thread
		import asyncio as _asyncio

		return await _asyncio.to_thread(
			extract_fields_from_image, image_path, instructions, model_name, max_output_chars
		)

	path = Path(image_path)
	if not path.exists():
		return {}
	with open(path, "rb") as f:
		b64 = base64.b64encode(f.read()).decode("utf-8")

	config = get_config()
	suffix = path.suffix.lower()
	mime = "image/png" if suffix == ".png" else "image/jpeg"
	model = model_name or config.model_name
	client = AsyncOpenAI(api_key=config.openai_api_key, base_url=config.openai_api_base)

	system_prompt = (
		"You are a document data extraction expert. Return a valid JSON object with the extracted data."
	)
	try:
		resp = await client.chat.completions.create(
			model=model,
			messages=[
				{"role": "system", "content": system_prompt},
				{
					"role": "user",
					"content": [
						{"type": "text", "text": f"{instructions[:max_output_chars]}"},
						{"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
					],
				},
			],
			response_format={"type": "json_object"},
			max_completion_tokens=1200,
		)
		content = resp.choices[0].message.content or "{}"
		return json.loads(content)
	except Exception as e:
		logger.exception("Async vision extraction failed: %s", e)
		return {}
