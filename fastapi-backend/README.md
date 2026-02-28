# ScanMan2 FastAPI Proxy

This is the backend component of the ScanMan2 dashboard. it acts as a secure proxy between the React frontend and your Tenable Security Center (SC) instance.

## 📋 Features

- **Tenable SC API Integration:** Proxies `Analysis` and `Query` requests.
- **Auto-Pagination:** Automatically handles large datasets by paginating requests to Tenable SC.
- **Flexible Modes:**
  - `main.py`: Production proxy using API keys.
  - `demo_backend.py`: Mock backend for testing without Tenable SC access.
- **CORS Support:** Configurable origins for secure cross-site requests.

## 🚀 Setup (Without Docker)

1.  **Install Python 3.12+**
2.  **Install Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
3.  **Configure Environment:**
    Create a `.env` file based on `.env.example`:
    ```env
    TENABLE_SC_HOST=https://your-tenable-sc-instance
    TENABLE_SC_ACCESS_KEY=your_access_key
    TENABLE_SC_SECRET_KEY=your_secret_key
    VERIFY_SSL=true
    ```
4.  **Run the Server:**
    ```bash
    # For production proxy
    uvicorn main:app --host 0.0.0.0 --port 8000
    
    # For demo mode (mock data)
    uvicorn demo_backend:app --host 0.0.0.0 --port 8000
    ```

## 🐳 Docker Deployment

In `docker-compose.yml`, the `tenable-proxy` service builds from the local `Dockerfile`. 

- **Internal Port:** 8000
- **Variable:** `BACKEND_MODULE` (set to `main` for real data, `demo_backend` for mock data).

## 🔗 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check proxy status and configuration. |
| `/analysis` | POST | Execute a Tenable SC analysis query (supports auto-pagination). |
| `/queries` | GET | List usable and manageable saved queries. |
| `/queries/{id}` | GET/PATCH/DELETE | CRUD operations for individual saved queries. |
| `/repositories` | GET | List available repositories. |

## 📚 Documentation Reference

- **Tenable SC Query API:** [Official Docs](https://docs.tenable.com/security-center/api/Query.htm)
- **Tenable SC Analysis API:** [Official Docs](https://docs.tenable.com/security-center/api/Analysis.htm)
