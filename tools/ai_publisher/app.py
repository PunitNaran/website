import streamlit as st
import google.generativeai as genai
import os
from datetime import datetime
import time
from git import Repo
import re

# Page Config
st.set_page_config(page_title="AI Publisher", page_icon="🚀", layout="wide")

st.title("🚀 AI Publisher for Hugo")
st.markdown("Generate and publish content to your website from anywhere.")

# Sidebar for Config
with st.sidebar:
    st.header("Configuration")
    api_key = st.text_input("Gemini API Key", type="password")
    
    st.divider()
    
    repo_path = st.text_input("Repo Path", value=os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))
    content_dir = st.text_input("Content Directory", value="content/posts")
    
    st.divider()
    st.subheader("Social Chains 🔗")
    generate_social = st.checkbox("Generate Social Media Posts", value=True)

# Main Interface
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("Drafting 📝")
    title = st.text_input("Post Title")
    topic = st.text_area("Topic / Rough Notes", height=150)
    style = st.select_slider("Writing Style", options=["Strictly Professional", "Technical", "Casual", "Witty", "Storytelling"], value="Technical")
    
    generate_btn = st.button("✨ Generate Draft", type="primary")

if 'draft_content' not in st.session_state:
    st.session_state.draft_content = ""

if 'social_content' not in st.session_state:
    st.session_state.social_content = {}

def sluggify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text)
    return text

if generate_btn and api_key:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    with st.spinner("Asking Gemini to write..."):
        prompt = f"""
        You are an expert technical writer. Write a blog post for a developer's portfolio website.
        
        **Title**: {title}
        **Topic/Notes**: {topic}
        **Style**: {style}
        
        **Output Format**:
        Strictly valid Markdown with Hugo Frontmatter.
        
        Example:
        ---
        title: "{title}"
        date: {datetime.now().isoformat()}
        draft: false
        tags: [tech, coding]
        categories: [development]
        author: "Punit Naran"
        ---
        
        [Article Body Here]
        """
        
        response = model.generate_content(prompt)
        st.session_state.draft_content = response.text
        
        if generate_social:
            social_prompt = f"""
            Based on the following blog post, write:
            1. A Tweet (max 280 chars) with hashtags.
            2. A LinkedIn post (professional summary).
            
            Blog Post:
            {response.text}
            
            Output JSON format: {{ "twitter": "...", "linkedin": "..." }}
            """
            try:
                social_resp = model.generate_content(social_prompt, generation_config={"response_mime_type": "application/json"})
                import json
                st.session_state.social_content = json.loads(social_resp.text)
            except Exception as e:
                st.error(f"Failed to generate social chains: {e}")

with col2:
    st.subheader("Preview & Publish 👁️")
    if st.session_state.draft_content:
        tab1, tab2 = st.tabs(["Markdown", "Rendered"])
        
        with tab1:
            edited_content = st.text_area("Edit Content", value=st.session_state.draft_content, height=400)
            st.session_state.draft_content = edited_content
        with tab2:
            st.markdown(st.session_state.draft_content)
        
        if generate_social and st.session_state.social_content:
            st.info("🐦 **Twitter**: " + st.session_state.social_content.get("twitter", ""))
            st.info("💼 **LinkedIn**: " + st.session_state.social_content.get("linkedin", ""))

        st.divider()
        
        publish_btn = st.button("🚀 Publish to Site", type="primary")
        
        if publish_btn:
            try:
                # 1. Save File
                slug = sluggify(title)
                date_str = datetime.now().strftime("%Y-%m-%d")
                filename = f"{date_str}-{slug}.md"
                full_path = os.path.join(repo_path, content_dir, filename)
                
                # Ensure dir exists
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(st.session_state.draft_content)
                
                st.success(f"Saved to {filename}")
                
                # 2. Git Operations
                with st.spinner("Pushing to Git..."):
                    repo = Repo(repo_path)
                    repo.git.add(full_path)
                    repo.index.commit(f"New post: {title} (via AI Publisher)")
                    origin = repo.remote(name='origin')
                    origin.push()
                    
                st.balloons()
                st.success("✅ Published Successfully!")
                
            except Exception as e:
                st.error(f"Error publishing: {e}")

if generate_btn and not api_key:
    st.error("Please provide a Gemini API Key.")
