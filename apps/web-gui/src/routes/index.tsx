import { createFileRoute } from '@tanstack/react-router'
import { DataflowLandingPage } from '../components/dataflow-landing-page'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return <DataflowLandingPage />
}
