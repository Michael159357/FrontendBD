"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Database, Clock, Users, Plane } from "lucide-react"
import "./App.css"

interface QueryResult {
  data: any[]
  tiempo: number
}

interface ApiError {
  error: string
}

const predefinedQueries = [
  {
    id: 1,
    title: "Gasto Promedio por Tipo de Tarifa (2017)",
    description: "Analiza el gasto promedio por clase tarifaria considerando el rango del avión",
    icon: <Users className="h-4 w-4" />,
    query: `SELECT 
    a.range,
    s.fare_conditions,
    ROUND(AVG(tf.amount), 2) AS avg_amount
FROM ticket_flights tf
JOIN flights f ON tf.flight_id = f.flight_id
JOIN seats s ON f.aircraft_code = s.aircraft_code
JOIN aircrafts_data a ON s.aircraft_code = a.aircraft_code
WHERE f.scheduled_departure BETWEEN '2017-01-01' AND '2017-12-31'
GROUP BY a.range, s.fare_conditions
ORDER BY a.range DESC, avg_amount DESC;`,
  },
  {
    id: 2,
    title: "Ciudades con Aeropuertos que Empiezan con 'S'",
    description: "Ciudades con mayor concentración de vuelos y pasajeros",
    icon: <Plane className="h-4 w-4" />,
    query: `SELECT 
    ad.city,
    COUNT(f.flight_id) AS total_flights,
    COUNT(bp.ticket_no) AS total_passengers
FROM flights f
JOIN airports_data ad ON f.departure_airport = ad.airport_code
JOIN boarding_passes bp ON f.flight_id = bp.flight_id
WHERE f.departure_airport LIKE 'S%'
GROUP BY ad.city
ORDER BY total_passengers DESC
LIMIT 5;`,
  },
  {
    id: 3,
    title: "Reservas con Mayor Ingreso",
    description: "Reservas con ingresos superiores a 500 y número de pasajeros",
    icon: <Database className="h-4 w-4" />,
    query: `SELECT 
    b.book_ref,
    COUNT(t.passenger_id) AS total_passengers,
    b.total_amount,
    ROUND(b.total_amount / COUNT(t.passenger_id), 2) AS avg_per_passenger
FROM bookings b
JOIN tickets t ON b.book_ref = t.book_ref
WHERE b.total_amount > 500
GROUP BY b.book_ref, b.total_amount
ORDER BY total_amount DESC
LIMIT 10;`,
  },
  {
    id: 4,
    title: "Eficiencia de Ingresos por Kilómetro",
    description: "Modelos de avión con mayor eficiencia de ingresos por kilómetro",
    icon: <Clock className="h-4 w-4" />,
    query: `SELECT
    ad.model AS modelo_avion,
    COUNT(DISTINCT f.flight_id) AS total_vuelos,
    SUM(tf.amount) AS ingresos_totales,
    a.range AS alcance_km,
    ROUND(SUM(tf.amount) / NULLIF(a.range * COUNT(DISTINCT f.flight_id), 0), 2) AS ingreso_por_km
FROM ticket_flights tf
JOIN flights f ON tf.flight_id = f.flight_id
JOIN aircrafts_data a ON f.aircraft_code = a.aircraft_code
JOIN (
    SELECT DISTINCT aircraft_code, model
    FROM aircrafts_data
) ad ON f.aircraft_code = ad.aircraft_code
WHERE tf.amount > 1000
  AND f.scheduled_departure >= '2017-07-10'
GROUP BY
    modelo_avion, a.range
HAVING
    COUNT(f.flight_id) > 5
ORDER BY
    ingreso_por_km DESC;`,
  },
]

export default function FlightQueriesApp() {
 
  const [selectedSchema, setSelectedSchema] = useState("public")
  const [customQuery, setCustomQuery] = useState("")
  const [results, setResults] = useState<QueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "connected" | "error">("unknown")
  const [controller, setController] = useState<AbortController | null>(null)

  const testConnection = async () => {
    try {
      const response = await fetch("http://3.145.72.62:5000/probar_conexion")
      if (response.ok) {
        setConnectionStatus("connected")
      } else {
        setConnectionStatus("error")
      }
    } catch (err) {
      setConnectionStatus("error")
    }
  }

  const executeQuery = async (query: string) => {
  if (!query.trim()) return

  setLoading(true)
  setError(null)
  setResults(null)

  const newController = new AbortController()
  setController(newController)

  try {
    const response = await fetch("http://3.145.72.62:5000/consulta", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: query.trim(), schema: selectedSchema }),
      signal: newController.signal, // 💡 señal para poder cancelar
    })

    const data = await response.json()

    if (response.ok) {
      setResults(data as QueryResult)
    } else {
      setError((data as ApiError).error || "Error desconocido")
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      setError("Consulta cancelada por el usuario")
    } else {
      setError("Error de conexión con el servidor")
    }
  } finally {
    setLoading(false)
    setController(null)
  }
}

  const handlePredefinedQuery = (query: string) => {
    setCustomQuery(query)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Consultas de Vuelos</h1>
          <p className="text-gray-600">Analiza datos de vuelos con consultas SQL optimizadas</p>

          <div className="flex justify-center gap-2">
            <label className="text-sm font-medium">Esquema:</label>
            <select
              value={selectedSchema}
              onChange={(e) => setSelectedSchema(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="sin_idx_1k">sin_idx_1k</option>
              <option value="con_idx_1k">con_idx_1k</option>
              <option value="sin_idx_10k">sin_idx_10k</option>
              <option value="con_idx_10k">con_idx_10k</option>
              <option value="sin_idx_100k">sin_idx_100k</option>
              <option value="con_idx_100k">con_idx_100k</option>
              <option value="public">public</option>
              <option value="con_indices">con_indices</option>
            </select>
          </div>


          {/* Connection Status */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={testConnection} className="text-xs bg-transparent">
              Probar Conexión
            </Button>
            {connectionStatus === "connected" && (
              <Badge variant="default" className="bg-green-500">
                Conectado
              </Badge>
            )}
            {connectionStatus === "error" && <Badge variant="destructive">Sin Conexión</Badge>}
          </div>
        </div>

        {/* Predefined Queries */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {predefinedQueries.map((queryItem) => (
            <Card
              key={queryItem.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePredefinedQuery(queryItem.query)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  {queryItem.icon}
                  <CardTitle className="text-sm">{queryItem.title}</CardTitle>
                </div>
                <CardDescription className="text-xs">{queryItem.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>

        {/* Query Input */}
        <Card>
          <CardHeader>
            <CardTitle>Consulta SQL</CardTitle>
            <CardDescription>Selecciona una consulta predefinida o escribe tu propia consulta SQL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="SELECT * FROM flights LIMIT 5"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              className="min-h-32 font-mono text-sm"
            />
            <Button
              onClick={() => executeQuery(customQuery)}
              disabled={loading || !customQuery.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Ejecutando...
                </>
              ) : (
                "Ejecutar Consulta"
              )}
            </Button>
            <Button
            onClick={() => controller?.abort()}
            disabled={!controller}
            variant="destructive"
            className="w-full"
          >
            Cancelar Consulta
          </Button>

          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {results && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Resultados</CardTitle>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <Badge variant="secondary">{results.tiempo}s</Badge>
                  <Badge variant="outline">{results.data.length} registros</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {results.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-50">
                        {Object.keys(results.data[0]).map((key) => (
                          <th key={key} className="border border-gray-300 px-4 py-2 text-left font-medium">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.data.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          {Object.values(row).map((value, cellIndex) => (
                            <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                              {value !== null ? String(value) : "NULL"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No se encontraron resultados</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
